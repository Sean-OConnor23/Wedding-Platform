import logging
import azure.functions as func
from Utils.config import settings, credential
from azure.cosmos import CosmosClient, exceptions

# 1. Initialize the Event Trigger Blueprint
photo_deleter_bp = func.Blueprint()



# 4. OFFICIAL EVENT GRID DECORATOR
# This is no longer an HTTP endpoint. It listens natively to Azure Event Grid messages!
@photo_deleter_bp.event_grid_trigger(arg_name="event")
def photo_deleter(event: func.EventGridEvent) -> None:
    logging.info(f"Native Event Grid notification captured. Event ID: {event.id}")

    try:

        COSMOS_DB_ENDPOINT = settings.get("AZURE-COSMOSDB-ENDPOINT")
        COSMOS_DATABASE_NAME = settings.get("AZURE-COSMOSDB-DB")
        COSMOS_CONTAINER_NAME = settings.get("AZURE-COSMOSDB-CONTAINER")

        cosmos_client = CosmosClient(url=COSMOS_DB_ENDPOINT, credential=credential)
        database = cosmos_client.get_database_client(COSMOS_DATABASE_NAME)
        container = database.get_container_client(COSMOS_CONTAINER_NAME)

        event_data = event.get_json()
        deleted_blob_url = event_data.get("url")

        if not deleted_blob_url:
            logging.warning("Event payload missing target file context. Skipping cleanup cycle.")
            return

        target_blob_name = deleted_blob_url.split("/")[-1]
        logging.info(f"Target file matching string recognized: {target_blob_name}. Locating database references...")

        query = "SELECT c.id, c.uploadDate FROM c WHERE c.blobName = @blobName"
        parameters = [{"name": "@blobName", "value": target_blob_name}]
        
        items = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))

        if not items:
            logging.info(f"No active record found tracking {target_blob_name}. Already clean.")
            return

        for document in items:
            doc_id = document["id"]
            partition_key_value = document["uploadDate"] # Your explicit Partition Key constraint

            logging.info(f"Purging Cosmos ID: {doc_id} under Partition Key: {partition_key_value}")
            container.delete_item(item=doc_id, partition_key=partition_key_value) # Execute NoSQL removal

        logging.info("Sanitization cycle complete. Cosmos registry fully synced.")

    except exceptions.AzureHttpResponseError as db_err:
        logging.error(f"Cosmos registry removal failure: {db_err.message}")
    except Exception as e:
        logging.error(f"Unexpected data-tier anomaly: {str(e)}")
