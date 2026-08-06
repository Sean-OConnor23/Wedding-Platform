import logging
import azure.functions as func
from azure.identity import DefaultAzureCredential
from azure.ai.vision.imageanalysis import ImageAnalysisClient
from azure.ai.vision.imageanalysis.models import VisualFeatures
from azure.cosmos import CosmosClient
from datetime import datetime
from Utils.config import settings, credential

photo_processor_bp = func.Blueprint()

@photo_processor_bp.blob_trigger(arg_name="myblob", path="wedding-photos/{name}", connection="AzureWebJobsStorage")
def photo_processor(myblob: func.InputStream) -> None:
    
    raw_file_name = myblob.name.split("/")[-1]
    file_id = raw_file_name.replace(".jpg", "").replace(".png", "")
    logging.info(f"Background worker analyzing AI verification for ID: {file_id}")

    VISION_ENDPOINT = settings.get("AZURE-VISION-ENDPOINT")
    COSMOS_DB_ENDPOINT = settings.get("AZURE-COSMOSDB-ENDPOINT")
    COSMOS_DATABASE_NAME = settings.get("AZURE-COSMOSDB-DB")
    COSMOS_CONTAINER_NAME = settings.get("AZURE-COSMOSDB-CONTAINER")
    
   
    raw_wedding_keywords = settings.get("WEDDING_PHOTO_UPLOAD_CONTEXT")
    WEDDING_KEYWORDS = {word.strip().lower() for word in raw_wedding_keywords.split(",")}

    raw_censored_keywords = settings.get("WEDDING_CENSORED_CONTEXT")
    CENSORED_KEYWORDS = {word.strip().lower() for word in raw_censored_keywords.split(",")}

    try:
        image_bytes = myblob.read()

        
        with ImageAnalysisClient(endpoint=VISION_ENDPOINT, credential=credential) as vision_client:
            analysis = vision_client.analyze(
                image_data=image_bytes,
                visual_features=[VisualFeatures.TAGS]
            )

        extracted_tags = [tag.name.lower() for tag in analysis.tags.list]
        logging.info(f"AI Vision v4.0 parsed tags for {file_id}: {extracted_tags}")

        gallery_status = "APPROVED"
        rejection_reason = ""

        raw_censored_keywords = settings.get("WEDDING_CENSORED_CONTEXT")
        CENSORED_KEYWORDS = {word.strip().lower() for word in raw_censored_keywords.split(",")}
        has_safety_violation = any(flag in CENSORED_KEYWORDS for flag in extracted_tags)

        if has_safety_violation:
            logging.warning(f"Censorship Event: Inappropriate content blocked in blob {raw_file_name}.")
            gallery_status = "REJECTED_CENSORED"
            rejection_reason = "Inappropriate content detected. This file cannot be shared."

        if gallery_status == "APPROVED":
            has_wedding_context = any(tag in WEDDING_KEYWORDS for tag in extracted_tags)
            
            if not has_wedding_context:
                logging.info(f"Context Mismatch: Image '{raw_file_name}' is off-topic. Hiding from gallery.")
                gallery_status = "REJECTED_OFF_TOPIC"
                rejection_reason = "This gallery is exclusively for wedding moments! It looks like this picture is a bit off-topic."

        cosmos_client = CosmosClient(url=COSMOS_DB_ENDPOINT, credential=credential)
        container = cosmos_client.get_database_client(COSMOS_DATABASE_NAME).get_container_client(COSMOS_CONTAINER_NAME)

        metadata_document = {
            "id": file_id, # Maps identically to your frontend status check routing query parameter
            "blobName": raw_file_name,
            "blobUri": f"https://windows.net{raw_file_name}",
            "uploadDate": datetime.utcnow().strftime("%Y-%m-%d"),
            "status": gallery_status,
            "rejectionReason": rejection_reason,
            "aiAnalysis": {
                "tags": extracted_tags
            }
        }

        container.upsert_item(body=metadata_document)
        logging.info(f"Background database write sync lifecycle complete. Status applied: {gallery_status}")

    except Exception as e:
        logging.error(f"Background worker processing cycle aborted: {str(e)}")
