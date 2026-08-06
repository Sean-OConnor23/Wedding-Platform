import json
import logging
import azure.functions as func
from azure.cosmos import CosmosClient, exceptions
from Utils.config import settings, credential

status_bp = func.Blueprint()

@status_bp.route(route="check-status", methods=["GET"])
def check_status(req: func.HttpRequest) -> func.HttpResponse:
    photo_id = req.params.get("id")
    if not photo_id:
        return func.HttpResponse("Missing ID parameter.", status_code=400)

    # Clean off any extensions or path junk to get the pure matching UUID string
    clean_id = photo_id.replace(".jpg", "").replace(".png", "").split("/")[-1]
    logging.info(f"Polling checkpoint inspecting metadata status for ID: {clean_id}")

    COSMOS_DB_ENDPOINT = settings.get("AZURE-COSMOSDB-ENDPOINT")
    COSMOS_DATABASE_NAME = settings.get("AZURE-COSMOSDB-DB")
    COSMOS_CONTAINER_NAME = settings.get("AZURE-COSMOSDB-CONTAINER")

    try:
        cosmos_client = CosmosClient(url=COSMOS_DB_ENDPOINT, credential=credential)
        container = cosmos_client.get_database_client(COSMOS_DATABASE_NAME).get_container_client(COSMOS_CONTAINER_NAME)
        
        # Select target status parameters using uniform variable casing
        query = "SELECT c.status, c.rejectionReason FROM c WHERE c.id = @photoId"
        parameters = [{"name": "@photoId", "value": clean_id}]
        
        items = list(container.query_items(
            query=query, 
            parameters=parameters, 
            enable_cross_partition_query=True
        ))

        # Condition A: Background trigger hasn't finished writing or ID mismatched. Keep waiting.
        if not items:
            logging.info(f"Registry document not found yet for ID: {clean_id}. Retrying...")
            return func.HttpResponse(body=json.dumps({"status": "PROCESSING"}), mimetype="application/json")

        # 💡 THE FIX: Extract the first matching dictionary record out of the results array cleanly
        db_record = items[0]
        logging.info(f"Match located for index {clean_id}. Database row status: {db_record.get('status')}")
        
        # Stream the flat JSON dictionary object directly down the wire to your Next.js Client
        return func.HttpResponse(body=json.dumps(db_record), mimetype="application/json")
        
    except Exception as e:
        logging.error(f"Status endpoint calculation anomaly: {str(e)}")
        # Fallback to processing so a temporary code error doesn't completely crash the user interface
        return func.HttpResponse(body=json.dumps({"status": "PROCESSING"}), mimetype="application/json")
