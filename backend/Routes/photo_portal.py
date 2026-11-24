import azure.functions as func
import logging
import json
import uuid
from azure.storage.blob.aio import BlobServiceClient as AsyncBlobServiceClient
from .factory import lifecycle

portal_bp = func.Blueprint()

@portal_bp.route(route="upload-image", methods=["POST"])
async def upload_image(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Processing an incoming guest photo upload stream via blueprint.")

    try:
        azure_settings = lifecycle.get_sync_settings()
        async_cosmos_client = await lifecycle.get_async_cosmos_client()
        azure_storage = azure_settings.get("AZURE-STORAGE-ENDPOINT")

        image_bytes = req.get_body()
        if not image_bytes:
            return func.HttpResponse(
                json.dumps({"error": "No binary image data detected in request body."}),
                status_code=400,
                mimetype="application/json"
            )

        unique_filename = f"guest-photo-{uuid.uuid4()}.jpg"

        async with AsyncBlobServiceClient(account_url=azure_storage, credential=lifecycle._async_credential) as blob_service_client:
            container_client = blob_service_client.get_container_client("wedding-photos")
            if not await container_client.exists():
                await container_client.create_container()

            blob_client = container_client.get_blob_client(unique_filename)
            await blob_client.upload_blob(image_bytes, overwrite=True)

        logging.info(f"Successfully uploaded {unique_filename} to Azure Blob Storage.")

        return func.HttpResponse(
            json.dumps({
                "message": "Upload complete!", 
                "filename": unique_filename,
                "status": "Queued for AI background analysis."
            }),
            status_code=202,
            mimetype="application/json"
        )

    except Exception as e:
        logging.error(f"Blueprint Image Ingestion Failure: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to upload image asset.", "details": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
