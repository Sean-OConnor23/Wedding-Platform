# Routes/get_photos.py
import azure.functions as func
import json
import logging
from datetime import datetime, timedelta, timezone
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from azure.cosmos import CosmosClient
from Utils.config import get_setting, get_credential

gallery_bp = func.Blueprint()

@gallery_bp.route(route="get-photos", methods=["GET"])
def get_photos(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Querying Cosmos DB for uploaded photo assets.")

    try:
        COSMOS_DB_ENDPOINT = get_setting("AZURE-COSMOSDB-ENDPOINT")
        COSMOS_DATABASE_NAME = get_setting("AZURE-COSMOSDB-DB")
        # Ensure this pulls your exact container tracking name configuration parameter
        PHOTOS_CONTAINER_NAME = get_setting("AZURE-COSMOSDB-CONTAINER") 

        cosmos_client = CosmosClient(url=COSMOS_DB_ENDPOINT, credential=get_credential())
        container = cosmos_client.get_database_client(COSMOS_DATABASE_NAME).get_container_client(PHOTOS_CONTAINER_NAME)

        # 🟢 FIX 1: Update SQL query to filter by your exact field: c.status = 'APPROVED'
        query = "SELECT * FROM c WHERE c.status = 'APPROVED' ORDER BY c._ts DESC"
        items = list(container.query_items(query=query, enable_cross_partition_query=True))

        storage_account = get_setting("AZURE-STORAGE-ENDPOINT")

        blob_service_client = BlobServiceClient(account_url=storage_account, credential=get_credential())

        start_time = datetime.now(timezone.utc)
        expiry_time = start_time + timedelta(hours=1)
        user_delegation_key = blob_service_client.get_user_delegation_key(
            key_start_time=start_time,
            key_expiry_time=expiry_time
        )

        gallery_manifest = []

        for item in items:
            blob_name = item.get("blobName")
            if not blob_name:
                continue

            sas_token = generate_blob_sas(
                account_name="weddingplatstorage",
                container_name="wedding-photos",
                blob_name=blob_name,
                user_delegation_key=user_delegation_key,
                permission=BlobSasPermissions(read=True),
                expiry=expiry_time,
                start=start_time
            )

            authenticated_url = f"{storage_account}/{'wedding-photos'}/{blob_name}?{sas_token}"

            ai_analysis = item.get("aiAnalysis", {})
            flat_tags_list = ai_analysis.get("tags", []) if isinstance(ai_analysis, dict) else []

            gallery_manifest.append({
                "id": item.get("id"),
                "url": authenticated_url,
                "guestName": item.get("guestName", "Wedding Guest"),
                "caption": item.get("caption", ""),
                "tags": flat_tags_list # Passes the clean flat array straight to React!
            })

        return func.HttpResponse(json.dumps(gallery_manifest), status_code=200, mimetype="application/json")

    except Exception as ex:
        logging.error(f"Failed to generate secure gallery asset stream: {str(ex)}")
        return func.HttpResponse(
            json.dumps({"error": f"Gallery generation exception: {str(ex)}"}),
            status_code=500, mimetype="application/json"
        )
