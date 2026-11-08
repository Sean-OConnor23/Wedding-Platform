import json
import logging
import azure.functions as func
from datetime import datetime, timedelta, timezone
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions

gallery_bp = func.Blueprint()

@gallery_bp.route(route="get-photos", methods=["GET"])
def get_photos(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Querying Cosmos DB for uploaded photo assets.")

    try:
        from function_app import config, cosmos_client, credential

        COSMOS_DATABASE_NAME = config["AZURE-COSMOSDB-DB"]
        PHOTOS_CONTAINER_NAME = config["AZURE-COSMOSDB-CONTAINER"] 
        storage_account_endpoint = config["AZURE-STORAGE-ENDPOINT"]

        container = cosmos_client.get_database_client(COSMOS_DATABASE_NAME).get_container_client(PHOTOS_CONTAINER_NAME)

        query = "SELECT * FROM c WHERE c.status = 'APPROVED' ORDER BY c._ts DESC"
        items = list(container.query_items(query=query, enable_cross_partition_query=True))

        blob_service_client = BlobServiceClient(account_url=storage_account_endpoint, credential=credential)

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

            authenticated_url = f"{storage_account_endpoint}/{'wedding-photos'}/{blob_name}?{sas_token}"

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
