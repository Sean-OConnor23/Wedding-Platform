import asyncio
import os
import logging
from datetime import datetime, timezone
import azure.functions as func
from azure.storage.blob import BlobServiceClient
from azure.ai.vision.imageanalysis import ImageAnalysisClient
from azure.ai.vision.imageanalysis.models import VisualFeatures
from Routes.factory import lifecycle

photo_processor_bp = func.Blueprint()

def _analyze_image_sync(vision_endpoint: str, credential, image_bytes: bytes) -> list[str]:
    """Runs synchronous Azure AI Vision analysis in a worker thread."""
    with ImageAnalysisClient(endpoint=vision_endpoint, credential=credential) as vision_client:
        analysis = vision_client.analyze(
            image_data=image_bytes,
            visual_features=[VisualFeatures.TAGS],
        )
    if not analysis.tags or not analysis.tags.list:
        return []
    return [tag.name.lower() for tag in analysis.tags.list]


def _delete_blob_sync(storage_endpoint: str, credential, container_name: str, blob_name: str) -> None:
    """Deletes rejected blobs synchronously inside a worker thread."""
    blob_service_client = BlobServiceClient(account_url=storage_endpoint, credential=credential)
    blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
    blob_client.delete_blob()


@photo_processor_bp.blob_trigger(
    arg_name="myblob",
    path="wedding-photos/{name}",
    connection="AzureWebJobsStorage",
    source="EventGrid",
)
async def photo_processor(myblob: func.InputStream) -> None:
    raw_file_name = myblob.name.split("/")[-1]
    file_id, _ = os.path.splitext(raw_file_name)
    logging.info(f"Background worker analyzing AI verification for ID: {file_id}")

    container = None
    storage_endpoint = ""

    try:
        cosmos_client = await lifecycle.get_async_cosmos_client()
        azure_settings = lifecycle.get_sync_settings()
        credential = lifecycle.get_sync_credential()

        vision_endpoint = azure_settings.get("AZURE-VISION-ENDPOINT")
        storage_endpoint = azure_settings.get("AZURE-STORAGE-ENDPOINT", "").rstrip("/")
        cosmos_db_name = azure_settings.get("AZURE-COSMOSDB-DB")
        cosmos_container_name = azure_settings.get("AZURE-COSMOSDB-CONTAINER")
        raw_wedding_keywords = azure_settings.get("WEDDING_PHOTO_UPLOAD_CONTEXT") or ""
        raw_censored_keywords = azure_settings.get("WEDDING_CENSORED_CONTEXT") or ""

        container = cosmos_client.get_database_client(cosmos_db_name).get_container_client(cosmos_container_name)

        wedding_keywords = {w.strip().lower() for w in raw_wedding_keywords.split(",") if w.strip()}
        censored_keywords = {w.strip().lower() for w in raw_censored_keywords.split(",") if w.strip()}

        # Offload blocking stream read & Vision API call so /check-status stays responsive
        image_bytes = await asyncio.to_thread(myblob.read)
        extracted_tags = await asyncio.to_thread(
            _analyze_image_sync, vision_endpoint, credential, image_bytes
        )
        logging.info(f"AI Vision parsed tags for {file_id}: {extracted_tags}")

        gallery_status = "APPROVED"
        rejection_reason = ""

        if any(flag in censored_keywords for flag in extracted_tags):
            logging.warning(f"Censorship Event: Inappropriate content blocked in blob {raw_file_name}.")
            gallery_status = "REJECTED_CENSORED"
            rejection_reason = "Inappropriate content detected. This file cannot be shared."
        elif not any(tag in wedding_keywords for tag in extracted_tags):
            logging.info(f"Context Mismatch: Image '{raw_file_name}' is off-topic.")
            gallery_status = "REJECTED_OFF_TOPIC"
            rejection_reason = "This gallery is exclusively for wedding moments! It looks like this picture is a bit off-topic."

        if gallery_status != "APPROVED":
            try:
                await asyncio.to_thread(
                    _delete_blob_sync, storage_endpoint, credential, "wedding-photos", raw_file_name
                )
            except Exception as blob_err:
                logging.error(f"Failed to delete unapproved blob {raw_file_name}: {blob_err}")

        metadata_document = {
            "id": file_id,
            "blobName": raw_file_name,
            "blobUri": f"{storage_endpoint}/wedding-photos/{raw_file_name}",
            "UploadDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "status": gallery_status,
            "rejectionReason": rejection_reason,
            "aiAnalysis": {"tags": extracted_tags},
        }

        await container.upsert_item(body=metadata_document)
        logging.info(f"Background sync complete for {file_id}. Status: {gallery_status}")

    except Exception as e:
        logging.error(f"Background worker processing aborted for {file_id}: {e}", exc_info=True)
        if container is not None:
            try:
                await container.upsert_item(
                    body={
                        "id": file_id,
                        "blobName": raw_file_name,
                        "status": "REJECTED_ERROR",
                        "rejectionReason": "Unable to process image format or size. Please try a standard JPEG/PNG.",
                    }
                )
            except Exception as db_err:
                logging.error(f"Failed to write error state to Cosmos DB for {file_id}: {db_err}")
