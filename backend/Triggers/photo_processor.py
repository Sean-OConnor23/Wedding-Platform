import logging
import azure.functions as func
from azure.storage.blob import BlobServiceClient
from azure.ai.vision.imageanalysis import ImageAnalysisClient
from azure.ai.vision.imageanalysis.models import VisualFeatures
from Routes.factory import lifecycle
from datetime import datetime, timezone

photo_processor_bp = func.Blueprint()

@photo_processor_bp.blob_trigger(arg_name="myblob", path="wedding-photos/{name}", connection="AzureWebJobsStorage", source="EventGrid")
async def photo_processor(myblob: func.InputStream) -> None:
    try:
        raw_file_name = myblob.name.split("/")[-1]
        file_id = raw_file_name.replace(".jpg", "").replace(".png", "")
        logging.info(f"Background worker analyzing AI verification for ID: {file_id}")

        cosmos_client = await lifecycle.get_async_cosmos_client()
        azure_settings = lifecycle.get_sync_settings()
        
        VISION_ENDPOINT = azure_settings.get("AZURE-VISION-ENDPOINT")
        STORAGE_ENDPOINT = azure_settings.get("AZURE-STORAGE-ENDPOINT", "").rstrip("/")
        COSMOS_DATABASE_NAME = azure_settings.get("AZURE-COSMOSDB-DB")
        COSMOS_CONTAINER_NAME = azure_settings.get("AZURE-COSMOSDB-CONTAINER")
        raw_wedding_keywords = azure_settings.get("WEDDING_PHOTO_UPLOAD_CONTEXT") or ""
        raw_censored_keywords = azure_settings.get("WEDDING_CENSORED_CONTEXT") or ""

        container = cosmos_client.get_database_client(COSMOS_DATABASE_NAME).get_container_client(COSMOS_CONTAINER_NAME)
        WEDDING_KEYWORDS = {word.strip().lower() for word in raw_wedding_keywords.split(",") if word.strip()}
        CENSORED_KEYWORDS = {word.strip().lower() for word in raw_censored_keywords.split(",") if word.strip()}
        image_bytes = myblob.read()

        with ImageAnalysisClient(endpoint=VISION_ENDPOINT, credential=lifecycle.get_sync_credential()) as vision_client:
            analysis = vision_client.analyze(
                image_data=image_bytes,
                visual_features=[VisualFeatures.TAGS]
            )

        extracted_tags = [tag.name.lower() for tag in analysis.tags.list]
        logging.info(f"AI Vision v4.0 parsed tags for {file_id}: {extracted_tags}")

        gallery_status = "APPROVED"
        rejection_reason = ""

        has_safety_violation = any(flag in CENSORED_KEYWORDS for flag in extracted_tags)

        if has_safety_violation:
            logging.warning(f"Censorship Event: Inappropriate content blocked in blob {raw_file_name}.")
            gallery_status = "REJECTED_CENSORED"
            rejection_reason = "Inappropriate content detected. This file cannot be shared."

        if gallery_status == "APPROVED":
            has_wedding_context = any(tag in WEDDING_KEYWORDS for tag in extracted_tags)
            
            if not has_wedding_context:
                logging.info(f"Context Mismatch: Image '{raw_file_name}' is off-topic. Hiding from gallery.")
                gallery_status = "REJECTED_OFF_TOPIC"
                rejection_reason = "This gallery is exclusively for wedding moments! It looks like this picture is a bit off-topic."

        if gallery_status != "APPROVED":
            logging.info(f"Sanitizing storage: Deleting rejected file '{raw_file_name}' from cloud container...")
            try:
                blob_service_client = BlobServiceClient(account_url=STORAGE_ENDPOINT, credential=lifecycle.get_sync_credential())
                blob_client = blob_service_client.get_blob_client(container="wedding-photos", blob=raw_file_name)
                blob_client.delete_blob()
                logging.info(f"Successfully deleted unapproved file binary: {raw_file_name}")
            except Exception as blob_err:
                logging.error(f"Failed to delete unapproved blob: {str(blob_err)}")

        metadata_document = {
            "id": file_id,
            "blobName": raw_file_name,
            "blobUri": f"{STORAGE_ENDPOINT}/wedding-photos/{raw_file_name}",
            "uploadDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "status": gallery_status,
            "rejectionReason": rejection_reason,
            "aiAnalysis": {
                "tags": extracted_tags
            }
        }

        await container.upsert_item(body=metadata_document)
        logging.info(f"Background database write sync lifecycle complete. Status applied: {gallery_status}")

    except Exception as e:
        logging.error(f"Background worker processing cycle aborted: {str(e)}")
