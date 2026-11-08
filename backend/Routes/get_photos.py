import json
import logging
from datetime import datetime, timedelta, timezone
import azure.functions as func

# Async Azure SDK components
from azure.storage.blob.aio import BlobServiceClient as AsyncBlobServiceClient
from azure.storage.blob import generate_blob_sas, BlobSasPermissions

# Import your lifecycle infrastructure factory
from .factory import lifecycle

gallery_bp = func.Blueprint()

@gallery_bp.route(route="get-photos", methods=["GET"])
async def get_photos(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Querying Cosmos DB asynchronously for uploaded photo assets.")

    try:
        # 1. Fetch connection-pooled clients and configuration settings safely
        cosmos_client = await lifecycle.get_async_cosmos_client()
        azure_settings = lifecycle.get_sync_settings()

        COSMOS_DATABASE_NAME = azure_settings.get("AZURE-COSMOSDB-DB")
        PHOTOS_CONTAINER_NAME = azure_settings.get("AZURE-COSMOSDB-CONTAINER")
        storage_account_endpoint = azure_settings.get("AZURE-STORAGE-ENDPOINT")

        if not all([COSMOS_DATABASE_NAME, PHOTOS_CONTAINER_NAME, storage_account_endpoint]):
            raise ValueError("Required configuration values are missing from App Configuration.")

        # 2. Get the async cosmos container engine
        database = cosmos_client.get_database_client(COSMOS_DATABASE_NAME)
        container = database.get_container_client(PHOTOS_CONTAINER_NAME)

        # 3. Stream query items asynchronously without blocking threads
        query = "SELECT * FROM c WHERE c.status = 'APPROVED' ORDER BY c._ts DESC"
        query_iterable = container.query_items(query=query, enable_cross_partition_query=True)
        
        items = []
        async for item in query_iterable:
            items.append(item)

        # 4. Perform non-blocking Async Blob Storage Operations
        # Using an async context manager ensures clean connection pool recycling
        async with AsyncBlobServiceClient(
            account_url=storage_account_endpoint, 
            credential=lifecycle._async_credential # Reuses the global async identity token
        ) as blob_service_client:

            start_time = datetime.now(timezone.utc)
            expiry_time = start_time + timedelta(hours=1)
            
            # Non-blocking async API call to Azure Storage
            user_delegation_key = await blob_service_client.get_user_delegation_key(
                key_start_time=start_time,
                key_expiry_time=expiry_time
            )

            gallery_manifest = []

            for item in items:
                blob_name = item.get("blobName")
                if not blob_name:
                    continue

                # SAS token generation logic is a mathematical hash operation (synchronous & instant)
                sas_token = generate_blob_sas(
                    account_name="weddingplatstorage",
                    container_name="wedding-photos",
                    blob_name=blob_name,
                    user_delegation_key=user_delegation_key,
                    permission=BlobSasPermissions(read=True),
                    expiry=expiry_time,
                    start=start_time
                )

                authenticated_url = f"{storage_account_endpoint.rstrip('/')}/wedding-photos/{blob_name}?{sas_token}"

                ai_analysis = item.get("aiAnalysis", {})
                flat_tags_list = ai_analysis.get("tags", []) if isinstance(ai_analysis, dict) else []

                gallery_manifest.append({
                    "id": item.get("id"),
                    "url": authenticated_url,
                    "guestName": item.get("guestName", "Wedding Guest"),
                    "caption": item.get("caption", ""),
                    "tags": flat_tags_list
                })

            return func.HttpResponse(
                body=json.dumps(gallery_manifest), 
                status_code=200, 
                mimetype="application/json"
            )

    except Exception as ex:
        logging.error(f"Production Failure generating secure gallery stream: {str(ex)}", exc_info=True)
        # Production standard: Hide low-level database error specifics from the client facing response
        return func.HttpResponse(
            body=json.dumps({"error": "Unable to process gallery request at this time."}),
            status_code=500, 
            mimetype="application/json"
        )
