import logging
import traceback
import azure.functions as func
from azure.cosmos import exceptions
from azure.cosmos.partition_key import NonePartitionKeyValue
from Routes.factory import lifecycle

photo_deleter_bp = func.Blueprint()

@photo_deleter_bp.event_grid_trigger(arg_name="event")
async def photo_deleter(event: func.EventGridEvent) -> None:
    try:
        logging.info(f"Native Event Grid notification captured. Event ID: {event.id}")

        cosmos_client = await lifecycle.get_async_cosmos_client()
        azure_settings = lifecycle.get_sync_settings()

        COSMOS_DATABASE_NAME = azure_settings.get("AZURE-COSMOSDB-DB")
        COSMOS_CONTAINER_NAME = azure_settings.get("AZURE-COSMOSDB-CONTAINER")

        container = cosmos_client.get_database_client(COSMOS_DATABASE_NAME).get_container_client(COSMOS_CONTAINER_NAME)

        event_data = event.get_json()
        deleted_blob_url = event_data.get("url")

        if not deleted_blob_url:
            logging.warning("Event payload missing target file context. Skipping cleanup cycle.")
            return

        target_blob_name = deleted_blob_url.split("/")[-1]
        logging.info(f"Target file matching string recognized: {target_blob_name}. Locating database references...")

        query = "SELECT c.id, c.UploadDate, c.uploadDate FROM c WHERE c.blobName = @blobName"
        parameters = [{"name": "@blobName", "value": target_blob_name}]
        
        items = [
            item async for item in container.query_items(
                query=query,
                parameters=parameters
            )
        ]

        if not items:
            logging.info(f"No active record found tracking {target_blob_name}. Already clean.")
            return

        for document in items:
            doc_id = document["id"]
            # Use UploadDate if present; otherwise NonePartitionKeyValue for legacy items missing /UploadDate
            partition_key_value = document.get("UploadDate") or NonePartitionKeyValue

            logging.info(f"Purging Cosmos ID: {doc_id} under Partition Key: {partition_key_value}")
            try:
                await container.delete_item(item=doc_id, partition_key=partition_key_value)
            except exceptions.CosmosResourceNotFoundError:
                logging.info(f"Cosmos ID {doc_id} was already deleted. Treating as synced.")

        logging.info("Sanitization cycle complete. Cosmos registry fully synced.")

    except exceptions.AzureHttpResponseError as db_err:
        logging.error(f"Cosmos registry removal failure: {db_err.message}")
    except Exception as e:
        logging.error(f"Unexpected data-tier anomaly: {str(e)}\n{traceback.format_exc()}")
