import azure.functions as func
import logging
import json
import os
import uuid
from azure.storage.blob import BlobServiceClient

# Initialize the blueprint router instead of a full app
portal_bp = func.Blueprint()

# Initialize the Blob Service Client using your local settings variable
storage_connection_string = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
blob_service_client = BlobServiceClient.from_connection_string(storage_connection_string)

@portal_bp.route(route="upload-image", methods=["POST"])
def upload_image(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Processing an incoming guest photo upload stream via blueprint.")

    try:
        # 1. Extract the raw image bytes from the request body stream
        image_bytes = req.get_body()
        
        if not image_bytes:
            return func.HttpResponse(
                json.dumps({"error": "No binary image data detected in request body."}),
                status_code=400,
                mimetype="application/json"
            )

        # 2. Dynamically generate a completely unique filename for the blob asset
        unique_filename = f"guest-photo-{uuid.uuid4()}.jpg"

        # 3. Locate or build the target container bucket in your Azure Storage Account
        container_client = blob_service_client.get_container_client("wedding-photos")
        if not container_client.exists():
            container_client.create_container()

        # 4. Stream the raw image bytes directly into the cloud storage bucket
        blob_client = container_client.get_blob_client(unique_filename)
        blob_client.upload_blob(image_bytes, overwrite=True)

        logging.info(f"Successfully uploaded {unique_filename} to Azure Blob Storage.")

        return func.HttpResponse(
            json.dumps({
                "message": "Upload complete!", 
                "filename": unique_filename,
                "status": "Queued for AI background analysis."
            }),
            status_code=202, # 202 Accepted status signaling an async workflow
            mimetype="application/json"
        )

    except Exception as e:
        logging.error(f"Blueprint Image Ingestion Failure: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Failed to upload image asset.", "details": str(e)}),
            status_code=500,
            mimetype="application/json"
        )
