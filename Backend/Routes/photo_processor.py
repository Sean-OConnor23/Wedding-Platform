import logging
import uuid
from datetime import datetime, timezone
from Utils.config import settings, credential
import azure.functions as func
from azure.cosmos import CosmosClient
from azure.ai.vision.imageanalysis import ImageAnalysisClient
from azure.ai.vision.imageanalysis.models import VisualFeatures

processor_bp = func.Blueprint()

@processor_bp.blob_trigger(
    arg_name="myblob", 
    path="wedding-photos/{name}", 
    connection="AzureWebJobsStorage"
)
def photo_processor(myblob: func.InputStream):
    logging.info(f"Triggered analysis pipeline for file: {myblob.name}")

    try:
        COSMOS_DB_ENDPOINT = settings.get("AZURE-COSMOSDB-ENDPOINT")
        VISION_ENDPOINT = settings.get("AZURE-VISION-ENDPOINT")

        vision_client = ImageAnalysisClient(endpoint=VISION_ENDPOINT, credential=credential)
        cosmos_client = CosmosClient(url=COSMOS_DB_ENDPOINT, credential=credential)
        container = cosmos_client.get_database_client("WeddingPlatDb").get_container_client("PhotoMetadata")
        # 1. Read raw image data directly from memory space
        image_bytes = myblob.read()
        
        # 2. FIX: Stream bytes directly to the AI Engine instead of sending a URL
        analysis_result = vision_client.analyze(
            image_data=image_bytes,
            visual_features=[VisualFeatures.TAGS]
        )
        
        # 3. Extract the vision tag outputs
        ai_vision_tags = [tag['name'] for tag in analysis_result.tags['values']] if analysis_result.tags else []
        logging.info(f"Extracted AI vision tags: {ai_vision_tags}")

        # 4. Formulate the Cosmos DB transactional metadata document
        today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        photo_document = {
            "id": str(uuid.uuid4()),
            "uploadDate": today_date,
            "blobName": myblob.name,
            "blobUri": myblob.uri,
            "processedAt": datetime.now(timezone.utc).isoformat(),
            "aiAnalysis": {
                "tags": ai_vision_tags
            },
            "status": "PROCESSED"
        }

        container.upsert_item(body=photo_document)
        logging.info(f"Transaction completed. Metadata logged to database container.")

    except Exception as pipeline_err:
        logging.error(f"Execution pipeline interrupted: {str(pipeline_err)}")
        raise pipeline_err
