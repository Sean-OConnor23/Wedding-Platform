import os
import json
import uuid
import logging
from datetime import datetime, timezone
import azure.functions as func
from azure.storage.blob import ContentSettings
from azure.storage.blob.aio import BlobServiceClient as AsyncBlobServiceClient
from azure.identity.aio import DefaultAzureCredential as AsyncDefaultAzureCredential
from .factory import lifecycle

portal_bp = func.Blueprint()

_async_credential: AsyncDefaultAzureCredential | None = None
_blob_service_client: AsyncBlobServiceClient | None = None


def _get_blob_service_client(storage_url: str) -> AsyncBlobServiceClient:
    """Reuses a singleton async credential and BlobServiceClient across warm invocations."""
    global _async_credential, _blob_service_client
    if _blob_service_client is None:
        _async_credential = AsyncDefaultAzureCredential(
            managed_identity_client_id=os.environ.get("AZURE_CLIENT_ID")
        )
        _blob_service_client = AsyncBlobServiceClient(
            account_url=storage_url,
            credential=_async_credential,
        )
    return _blob_service_client


@portal_bp.route(route="upload-image", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
async def upload_image(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Processing an incoming guest photo upload stream via blueprint.")

    try:
        azure_settings = lifecycle.get_sync_settings()
        azure_storage = azure_settings.get("AZURE-STORAGE-ENDPOINT", "").rstrip("/")
        cosmos_db_name = azure_settings.get("AZURE-COSMOSDB-DB")
        cosmos_container_name = azure_settings.get("AZURE-COSMOSDB-CONTAINER")

        if not azure_storage:
            raise ValueError("AZURE-STORAGE-ENDPOINT is missing from App Configuration.")

        image_bytes = req.get_body()
        if not image_bytes:
            return func.HttpResponse(
                json.dumps({"error": "No binary image data detected in request body."}),
                status_code=400,
                mimetype="application/json",
            )

        today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        file_id = f"guest-photo-{today_utc}-{uuid.uuid4()}"
        unique_filename = f"{file_id}.jpg"
        content_type = req.headers.get("Content-Type") or "image/jpeg"

        # 1. Seed initial PROCESSING state in Cosmos DB so /check-status never hits a 404 race
        if cosmos_db_name and cosmos_container_name:
            cosmos_client = await lifecycle.get_async_cosmos_client()
            container = cosmos_client.get_database_client(cosmos_db_name).get_container_client(
                cosmos_container_name
            )
            await container.upsert_item(
                body={
                    "id": file_id,
                    "blobName": unique_filename,
                    "blobUri": f"{azure_storage}/wedding-photos/{unique_filename}",
                    "UploadDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    "status": "PROCESSING",
                    "rejectionReason": "",
                    "aiAnalysis": {"tags": []},
                }
            )

        blob_service_client = _get_blob_service_client(azure_storage)
        blob_client = blob_service_client.get_blob_client(
            container="wedding-photos", blob=unique_filename
        )
        await blob_client.upload_blob(
            image_bytes,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )

        logging.info(f"Successfully uploaded {unique_filename} to Azure Blob Storage.")

        return func.HttpResponse(
            json.dumps({
                "message": "Upload complete!",
                "filename": unique_filename,
                "id": file_id,
                "status": "Queued for AI background analysis.",
            }),
            status_code=202,
            mimetype="application/json",
        )

    except Exception as e:
        logging.error(f"Blueprint Image Ingestion Failure: {str(e)}", exc_info=True)
        return func.HttpResponse(
            json.dumps({"error": "Failed to upload image asset.", "details": str(e)}),
            status_code=500,
            mimetype="application/json",
        )
