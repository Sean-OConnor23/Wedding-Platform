import os
import re
import json
import logging
import azure.functions as func
from azure.cosmos.exceptions import CosmosResourceNotFoundError
from .factory import lifecycle

status_bp = func.Blueprint()

DATE_PREFIX_RE = re.compile(r"^guest-photo-(\d{4}-\d{2}-\d{2})-")


@status_bp.route(route="check-status", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
async def check_status(req: func.HttpRequest) -> func.HttpResponse:
    photo_id = req.params.get("id")
    if not photo_id:
        return func.HttpResponse(
            body=json.dumps({"error": "Missing 'id' query parameter."}),
            status_code=400,
            mimetype="application/json",
        )

    raw_name = photo_id.split("/")[-1]
    clean_id, _ = os.path.splitext(raw_name)

    try:
        azure_settings = lifecycle.get_sync_settings()
        async_cosmos_client = await lifecycle.get_async_cosmos_client()

        cosmos_db_name = azure_settings.get("AZURE-COSMOSDB-DB")
        cosmos_container_name = azure_settings.get("AZURE-COSMOSDB-CONTAINER")

        if not cosmos_db_name or not cosmos_container_name:
            raise ValueError("Cosmos DB settings are missing from App Configuration.")

        container = async_cosmos_client.get_database_client(cosmos_db_name).get_container_client(
            cosmos_container_name
        )

        # Fast path: Extract partition key (uploadDate) from ID for a 1-RU point read
        date_match = DATE_PREFIX_RE.match(clean_id)
        if date_match:
            upload_date = date_match.group(1)
            try:
                db_record = await container.read_item(
                    item=clean_id,
                    partition_key=upload_date,
                )
                return func.HttpResponse(
                    body=json.dumps({
                        "status": db_record.get("status", "PROCESSING"),
                        "rejectionReason": db_record.get("rejectionReason", ""),
                    }),
                    status_code=200,
                    mimetype="application/json",
                )
            except CosmosResourceNotFoundError:
                return func.HttpResponse(
                    body=json.dumps({"status": "PROCESSING"}),
                    status_code=200,
                    mimetype="application/json",
                )

        # Fallback path: Cross-partition query if ID does not embed the date
        query = "SELECT c.status, c.rejectionReason FROM c WHERE c.id = @photoId"
        parameters = [{"name": "@photoId", "value": clean_id}]
        items = [
            item
            async for item in container.query_items(
                query=query,
                parameters=parameters,
            )
        ]

        if not items:
            return func.HttpResponse(
                body=json.dumps({"status": "PROCESSING"}),
                status_code=200,
                mimetype="application/json",
            )

        db_record = items[0]
        return func.HttpResponse(
            body=json.dumps({
                "status": db_record.get("status", "PROCESSING"),
                "rejectionReason": db_record.get("rejectionReason", ""),
            }),
            status_code=200,
            mimetype="application/json",
        )

    except Exception as e:
        logging.error(f"Status check failed for ID {clean_id}: {str(e)}", exc_info=True)
        return func.HttpResponse(
            body=json.dumps({"error": "Failed to retrieve photo status."}),
            status_code=500,
            mimetype="application/json",
        )
