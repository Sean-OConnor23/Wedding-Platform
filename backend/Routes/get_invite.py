import json
import logging
import azure.functions as func
from azure.cosmos.exceptions import CosmosResourceNotFoundError
from .factory import lifecycle

rsvp_bp = func.Blueprint()


@rsvp_bp.route(route="get-invite", methods=["GET"])
async def get_invite(req: func.HttpRequest) -> func.HttpResponse:
    try:
        logging.info("Processing email lookup query request.")

        email = (req.params.get("email") or "").strip().lower()
        if not email:
            return func.HttpResponse(
                json.dumps({"error": "Missing email parameter."}),
                status_code=400,
                mimetype="application/json",
            )

        cosmos_client = await lifecycle.get_async_cosmos_client()
        azure_settings = lifecycle.get_sync_settings()

        cosmos_db_name = azure_settings.get("AZURE-COSMOSDB-DB")
        rsvp_container_name = azure_settings.get("AZURE-COSMOSDB-RSVP-CONTAINER")

        if not cosmos_db_name or not rsvp_container_name:
            raise ValueError("Cosmos DB RSVP settings are missing from App Configuration.")

        container = cosmos_client.get_database_client(cosmos_db_name).get_container_client(
            rsvp_container_name
        )

        # Narrow projection + case-insensitive email match
        query = (
            "SELECT c.id, c.guestName, c.email, c.hasResponded, "
            "c.isAttending, c.mealSelection, c.comments "
            "FROM c WHERE LOWER(c.email) = @email"
        )
        parameters = [{"name": "@email", "value": email}]

        items = [
            item
            async for item in container.query_items(
                query=query,
                parameters=parameters,
            )
        ]

        if not items:
            return func.HttpResponse(
                body=json.dumps({"found": False}),
                status_code=200,
                mimetype="application/json",
            )

        doc = items
        clean_invite = {
            "id": doc.get("id"),
            "guestName": doc.get("guestName", ""),
            "email": doc.get("email", ""),
            "hasResponded": bool(doc.get("hasResponded", False)),
            "isAttending": bool(doc.get("isAttending", False)),
            "mealSelection": doc.get("mealSelection", ""),
            "comments": doc.get("comments", ""),
        }

        return func.HttpResponse(
            json.dumps(clean_invite),
            status_code=200,
            mimetype="application/json",
        )

    except Exception as ex:
        logging.error(f"Cosmos DB retrieval failure in get_invite: {str(ex)}", exc_info=True)
        return func.HttpResponse(
            json.dumps({"error": "Unable to retrieve invitation at this time."}),
            status_code=500,
            mimetype="application/json",
        )


@rsvp_bp.route(route="update-rsvp", methods=["POST"])
async def update_rsvp(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Processing RSVP update request.")

    try:
        try:
            body = req.get_json()
        except ValueError:
            return func.HttpResponse(
                json.dumps({"error": "Invalid JSON request body."}),
                status_code=400,
                mimetype="application/json",
            )

        invite_id = (body.get("id") or "").strip()
        email = (body.get("email") or "").strip().lower()

        if not invite_id or not email:
            return func.HttpResponse(
                json.dumps({"error": "Missing required invitation identifiers."}),
                status_code=400,
                mimetype="application/json",
            )

        cosmos_client = await lifecycle.get_async_cosmos_client()
        azure_settings = lifecycle.get_sync_settings()

        cosmos_db_name = azure_settings.get("AZURE-COSMOSDB-DB")
        rsvp_container_name = azure_settings.get("AZURE-COSMOSDB-RSVP-CONTAINER")

        if not cosmos_db_name or not rsvp_container_name:
            raise ValueError("Cosmos DB RSVP settings are missing from App Configuration.")

        container = cosmos_client.get_database_client(cosmos_db_name).get_container_client(
            rsvp_container_name
        )

        # Point read using /email partition key
        try:
            existing_item = await container.read_item(item=invite_id, partition_key=email)
        except CosmosResourceNotFoundError:
            return func.HttpResponse(
                json.dumps({"error": "Invitation record not found."}),
                status_code=404,
                mimetype="application/json",
            )

        is_attending = bool(body.get("isAttending", False))
        existing_item["isAttending"] = is_attending
        existing_item["mealSelection"] = str(body.get("mealSelection", "")).strip() if is_attending else ""
        existing_item["comments"] = str(body.get("comments", "")).strip()[:1000]
        existing_item["hasResponded"] = True

        await container.upsert_item(body=existing_item)
        return func.HttpResponse(
            json.dumps({"success": True}),
            status_code=200,
            mimetype="application/json",
        )

    except Exception as ex:
        logging.error(f"Failed to record RSVP update: {str(ex)}", exc_info=True)
        return func.HttpResponse(
            json.dumps({"error": "Unable to save RSVP changes at this time."}),
            status_code=500,
            mimetype="application/json",
        )
