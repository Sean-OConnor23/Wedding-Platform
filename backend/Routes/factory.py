import os
import asyncio
from azure.identity import DefaultAzureCredential
from azure.identity.aio import DefaultAzureCredential as AsyncDefaultAzureCredential
from azure.appconfiguration.provider import load
from azure.cosmos.aio import CosmosClient as AsyncCosmosClient
from azure.keyvault.secrets import SecretClient

class ProductionAppLifecycle:
    def __init__(self):
        self._settings = None
        self._async_credential = None
        self._async_cosmos_client = None
        self._lock = asyncio.Lock()

    def get_sync_settings(self):
        """
        Safely retrieves configurations from Azure App Configuration.
        This runs once synchronously on the first actual function invocation,
        preventing your app from crashing during portal indexing.
        """
        if self._settings is None:
            endpoint = os.environ.get("AZURE_APP_CONFIG_ENDPOINT")
            if not endpoint:
                raise KeyError("Production Error: 'AZURE_APP_CONFIG_ENDPOINT' environment variable is missing.")
            
            sync_credential = DefaultAzureCredential()

            def _vault_secret_resolver(secret_uri: str) -> str:
                # Layout: https://<vault-name>.vault.azure.net/secrets/<secret-name>/<version>
                uri_parts = secret_uri.split('/secrets/')
                base_vault_url = uri_parts[0]
                secret_name = uri_parts[1].split('/')[0]
                
                # Instantiated dynamically inside the resolver worker to prevent leakage
                kv_client = SecretClient(vault_url=base_vault_url, credential=sync_credential)
                return kv_client.get_secret(secret_name).value

            self._settings = load(
                endpoint=endpoint,
                credential=sync_credential,
                secret_resolver=_vault_secret_resolver,
                refresh_interval=300
            )
        return self._settings

    async def get_async_cosmos_client(self) -> AsyncCosmosClient:
        """
        Thread-safe, non-blocking asynchronous accessor for your database client.
        Uses connection pooling automatically to prevent socket exhaustion.
        """
        if self._async_cosmos_client is None:
            async with self._lock:
                # Double-check pattern for thread safety under high concurrency
                if self._async_cosmos_client is None:
                    self._async_credential = AsyncDefaultAzureCredential()
                    settings = self.get_sync_settings()
                    
                    cosmos_endpoint = settings.get("AZURE-COSMOSDB-ENDPOINT")
                    if not cosmos_endpoint:
                        raise ValueError("Production Error: 'AZURE-COSMOSDB-ENDPOINT' missing from App Configuration.")
                    
                    self._async_cosmos_client = AsyncCosmosClient(
                        url=cosmos_endpoint, 
                        credential=self._async_credential
                    )
        return self._async_cosmos_client

# Single, globally accessible production orchestrator instance
lifecycle = ProductionAppLifecycle()
