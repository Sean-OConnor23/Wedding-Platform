import azure.functions as func
import json
import logging
from Utils.config import get_setting, get_credential

rsvp_bp = func.Blueprint()

_container_cache = None

def get_cosmos_container():
    """Dynamically initializes and caches the Cosmos container to prevent startup crashes."""
    global _container_cache
    if _container_cache is not None:
        return _container_cache

    from azure.cosmos import CosmosClient

    endpoint = get_setting("AZURE-COSMOSDB-ENDPOINT")
    db_name = get_setting("AZURE-COSMOSDB-DB")
    container_name = get_setting("AZURE-COSMOSDB-RSVP-CONTAINER")

    if not endpoint:
        logging.critical("CRITICAL CONFIG ERROR: 'AZURE-COSMOSDB-ENDPOINT' returned None or Empty!")
        raise ValueError("AZURE-COSMOSDB-ENDPOINT config value is missing. Check your local settings/Azure App Config mapping.")

    logging.info(f"Initializing CosmosClient keylessly targeting endpoint: {endpoint}")
    client = CosmosClient(url=endpoint, credential=get_credential())
    _container_cache = client.get_database_client(db_name).get_container_client(container_name)
    return _container_cache


@rsvp_bp.route(route="get-invite", methods=["GET"])
def get_invite(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Processing email lookup query request.")
    
    email = req.params.get("email")
    if not email:
        return func.HttpResponse(
            json.dumps({"error": "Missing email parameter"}),
            status_code=400, mimetype="application/json"
        )

    try:
        # Get the container instance dynamically
        container = get_cosmos_container()
        
        query = "SELECT * FROM c WHERE c.email = @email"
        parameters = [{"name": "@email", "value": email.strip().lower()}]
        
        items = list(container.query_items(
            query=query, parameters=parameters, enable_cross_partition_query=True
        ))

        if not items:
            return func.HttpResponse(
                json.dumps({"error": "No invitation matches this identity profile"}),
                status_code=404, mimetype="application/json"
            )

        return func.HttpResponse(
            json.dumps(items[0]), status_code=200, mimetype="application/json"
        )

    except Exception as ex:
        logging.error(f"Cosmos DB connection failure: {str(ex)}")
        return func.HttpResponse(
            json.dumps({"error": "Database retrieval anomaly"}), status_code=500, mimetype="application/json"
        )

# --- ENDPOINT 2: POST UPDATE RSVP STATE ---
@rsvp_bp.route(route="update-rsvp", methods=["POST"])
def update_rsvp(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Processing point mutation update response payload.")

    try:
        body = req.get_json()
        invite_id = body.get("id")
        email = body.get("email")
        
        if not invite_id or not email:
            return func.HttpResponse(
                json.dumps({"error": "Missing unique index parameters"}),
                status_code=400, mimetype="application/json"
            )

        # Get the container instance dynamically
        container = get_cosmos_container()

        existing_item = container.read_item(item=invite_id, partition_key=email)
        existing_item["isAttending"] = bool(body.get("isAttending", False))
        existing_item["mealSelection"] = str(body.get("mealSelection", ""))
        existing_item["comments"] = str(body.get("comments", ""))
        existing_item["hasResponded"] = True

        container.upsert_item(body=existing_item)
        return func.HttpResponse(json.dumps({"success": True}), status_code=200, mimetype="application/json")

    except Exception as ex:
        logging.error(f"Failed to record state transition: {str(ex)}")
        return func.HttpResponse(
            json.dumps({"error": f"Database mutation fault: {str(ex)}"}), status_code=500, mimetype="application/json"
        )

