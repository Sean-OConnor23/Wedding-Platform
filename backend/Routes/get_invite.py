import azure.functions as func
import json
import logging
from .factory import lifecycle

rsvp_bp = func.Blueprint()

@rsvp_bp.route(route="get-invite", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
async def get_invite(req: func.HttpRequest) -> func.HttpResponse:
    try:
        logging.info("Processing email lookup query request.")
            
        email = req.params.get("email")
        if not email:
            return func.HttpResponse(
                json.dumps({"error": "Missing email parameter"}),
                status_code=400, mimetype="application/json")

        cosmos_client = await lifecycle.get_async_cosmos_client()
        azure_settings = lifecycle.get_sync_settings()

        COSMOS_DATABASE_NAME = azure_settings.get("AZURE-COSMOSDB-DB")
        RSVP_CONTAINER_NAME = azure_settings.get("AZURE-COSMOSDB-RSVP-CONTAINER")

        container = cosmos_client.get_database_client(COSMOS_DATABASE_NAME).get_container_client(RSVP_CONTAINER_NAME)
        
        query = "SELECT * FROM c WHERE c.email = @email"
        parameters = [{"name": "@email", "value": email.strip().lower()}]
        
        items = [
            item async for item in container.query_items(
                query=query, parameters=parameters
            )
        ]

        if not items:
            return func.HttpResponse(
                json.dumps({"error": "No invitation matches this identity profile"}),
                status_code=404, mimetype="application/json"
            )

        return func.HttpResponse(
            json.dumps(items), status_code=200, mimetype="application/json"
        )

    except Exception as ex:
        logging.error(f"Cosmos DB connection failure: {str(ex)}")
        return func.HttpResponse(
            json.dumps({"error": "Database retrieval anomaly"}), status_code=500, mimetype="application/json"
        )

# --- ENDPOINT 2: POST UPDATE RSVP STATE ---
@rsvp_bp.route(route="update-rsvp", methods=["POST"])
async def update_rsvp(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Processing point mutation update response payload.")

    try:
        body = req.get_json()
        invite_id = body.get("id")
        email = (body.get("email") or "").strip().lower()
        
        if not invite_id or not email:
            return func.HttpResponse(
                json.dumps({"error": "Missing unique index parameters"}),
                status_code=400, mimetype="application/json"
            )

        cosmos_client = await lifecycle.get_async_cosmos_client()
        azure_settings = lifecycle.get_sync_settings()
        
        COSMOS_DATABASE_NAME = azure_settings.get("AZURE-COSMOSDB-DB")
        RSVP_CONTAINER_NAME = azure_settings.get("AZURE-COSMOSDB-RSVP-CONTAINER")
        
        container = cosmos_client.get_database_client(COSMOS_DATABASE_NAME).get_container_client(RSVP_CONTAINER_NAME)

        existing_item = await container.read_item(item=invite_id, partition_key=email)
        existing_item["isAttending"] = bool(body.get("isAttending", False))
        existing_item["mealSelection"] = str(body.get("mealSelection", ""))
        existing_item["comments"] = str(body.get("comments", ""))
        existing_item["hasResponded"] = True

        await container.upsert_item(body=existing_item)
        return func.HttpResponse(json.dumps({"success": True}), status_code=200, mimetype="application/json")

    except Exception as ex:
        logging.error(f"Failed to record state transition: {str(ex)}")
        return func.HttpResponse(
            json.dumps({"error": f"Database mutation fault: {str(ex)}"}), status_code=500, mimetype="application/json"
        )
