import json
import logging
from urllib.parse import urlparse
from datetime import datetime, timedelta, timezone
import azure.functions as func
from azure.storage.blob.aio import BlobServiceClient as AsyncBlobServiceClient
from azure.storage.blob import generate_blob_sas, BlobSasPermissions, UserDelegationKey
from .factory import lifecycle

gallery_bp = func.Blueprint()

_blob_service_client: AsyncBlobServiceClient | None = None
_cached_delegation_key: UserDelegationKey | None = None
_delegation_key_expires_at: datetime | None = None


def _get_blob_client(storage_url: str) -> AsyncBlobServiceClient:
    """Reuses a singleton AsyncBlobServiceClient across warm invocations."""
    global _blob_service_client
    if _blob_service_client is None:
        _blob_service_client = AsyncBlobServiceClient(
            account_url=storage_url,
            credential=lifecycle._async_credential,
        )
    return _blob_service_client


async def _get_cached_delegation_key(
    blob_service_client: AsyncBlobServiceClient,
) -> tuple[UserDelegationKey, datetime, datetime]:
    """Caches the UserDelegationKey for 45 minutes to avoid extra Azure Storage calls."""
    global _cached_delegation_key, _delegation_key_expires_at

    now = datetime.now(timezone.utc)
    # Pad start_time by 5 minutes to protect against server clock skew
    sas_start = now - timedelta(minutes=5)
    sas_expiry = now + timedelta(hours=1)

    if (
        _cached_delegation_key is None
        or _delegation_key_expires_at is None
        or now >= _delegation_key_expires_at
    ):
        _cached_delegation_key = await blob_service_client.get_user_delegation_key(
            key_start_time=sas_start,
            key_expiry_time=sas_expiry,
        )
        _delegation_key_expires_at = now + timedelta(minutes=45)

    return _cached_delegation_key, sas_start, sas_expiry


@gallery_bp.route(route="get-photos", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
async def get_photos(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Querying Cosmos DB asynchronously for uploaded photo assets.")

    try:
        cosmos_client = await lifecycle.get_async_cosmos_client()
        azure_settings = lifecycle.get_sync_settings()

        cosmos_db_name = azure_settings.get("AZURE-COSMOSDB-DB")
        photos_container_name = azure_settings.get("AZURE-COSMOSDB-CONTAINER")
        storage_account_endpoint = azure_settings.get("AZURE-STORAGE-ENDPOINT", "").rstrip("/")

        if not all([cosmos_db_name, photos_container_name, storage_account_endpoint]):
            raise ValueError("Required configuration values are missing from App Configuration.")

        parsed_host = urlparse(storage_account_endpoint).hostname or ""
        account_name = parsed_host.split(".")[0] if parsed_host else "weddingplatstorage"

        container = cosmos_client.get_database_client(cosmos_db_name).get_container_client(
            photos_container_name
        )

        query = (
            "SELECT c.id, c.blobName, c.guestName, c.caption, c.aiAnalysis "
            "FROM c WHERE c.status = 'APPROVED' ORDER BY c._ts DESC"
        )
        items = [item async for item in container.query_items(query=query)]

        blob_service_client = _get_blob_client(storage_account_endpoint)
        user_delegation_key, start_time, expiry_time = await _get_cached_delegation_key(
            blob_service_client
        )

        gallery_manifest = []
        for item in items:
            blob_name = item.get("blobName")
            if not blob_name:
                continue

            sas_token = generate_blob_sas(
                account_name=account_name,
                container_name="wedding-photos",
                blob_name=blob_name,
                user_delegation_key=user_delegation_key,
                permission=BlobSasPermissions(read=True),
                expiry=expiry_time,
                start=start_time,
            )

            authenticated_url = f"{storage_account_endpoint}/wedding-photos/{blob_name}?{sas_token}"

            ai_analysis = item.get("aiAnalysis")
            flat_tags_list = (
                ai_analysis.get("tags", [])
                if isinstance(ai_analysis, dict) and isinstance(ai_analysis.get("tags"), list)
                else []
            )

            gallery_manifest.append({
                "id": item.get("id"),
                "url": authenticated_url,
                "guestName": item.get("guestName") or "Wedding Guest",
                "caption": item.get("caption") or "",
                "tags": flat_tags_list,
            })

        return func.HttpResponse(
            body=json.dumps(gallery_manifest),
            status_code=200,
            mimetype="application/json",
        )

    except Exception as ex:
        logging.error(f"Production Failure generating secure gallery stream: {str(ex)}", exc_info=True)
        return func.HttpResponse(
            body=json.dumps({"error": "Unable to process gallery request at this time."}),
            status_code=500,
            mimetype="application/json",
        )
