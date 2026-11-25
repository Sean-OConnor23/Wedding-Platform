import json
import logging
import azure.functions as func
from .factory import lifecycle

status_bp = func.Blueprint()

@status_bp.route(route="check-status", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
async def check_status(req: func.HttpRequest) -> func.HttpResponse:
    try:
        photo_id = req.params.get("id")
        if not photo_id:
            return func.HttpResponse("Missing ID parameter.", status_code=400)
        
        azure_settings = lifecycle.get_sync_settings()
        async_cosmos_client = await lifecycle.get_async_cosmos_client()

        COSMOS_DATABASE_NAME = azure_settings.get("AZURE-COSMOSDB-DB")
        COSMOS_CONTAINER_NAME = azure_settings.get("AZURE-COSMOSDB-CONTAINER")
        
        clean_id = photo_id.replace(".jpg", "").replace(".png", "").split("/")[-1]
        logging.info(f"Polling checkpoint inspecting metadata status for ID: {clean_id}")

        container = async_cosmos_client.get_database_client(COSMOS_DATABASE_NAME).get_container_client(COSMOS_CONTAINER_NAME)
        
        query = "SELECT c.status, c.rejectionReason FROM c WHERE c.id = @photoId"
        parameters = [{"name": "@photoId", "value": clean_id}]
        
        # Must use 'async for' with AsyncCosmosClient
        items = [
            item async for item in container.query_items(
                query=query, 
                parameters=parameters
            )
        ]

        if not items:
            logging.info(f"Registry document not found yet for ID: {clean_id}. Retrying...")
            return func.HttpResponse(body=json.dumps({"status": "PROCESSING"}), mimetype="application/json")

        db_record = items[0]
        logging.info(f"Match located for index {clean_id}. Database row status: {db_record.get('status')}")
        
        return func.HttpResponse(body=json.dumps(db_record), mimetype="application/json")
        
    except Exception as e:
        logging.error(f"Status endpoint calculation anomaly: {str(e)}")
        return func.HttpResponse(body=json.dumps({"status": "PROCESSING"}), mimetype="application/json")
