import os
import logging
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from azure.appconfiguration import AzureAppConfigurationClient

# Global placeholders for singletons
_app_config_client = None
_cached_settings = {}

def get_setting(key_name: str) -> str:
    """Production-grade lazy loader for App Configuration keys."""
    global _app_config_client, _cached_settings

    # 1. Return immediately if we already fetched this key
    if key_name in _cached_settings:
        return _cached_settings[key_name]

    # 2. Check for an explicit local environment fallback variable first
    if os.environ.get(key_name):
        return os.environ.get(key_name)

    # 3. Initialize the cloud configuration client only on the first active API call
    if _app_config_client is None:
        endpoint = os.environ.get("AppConfig_Endpoint")
        
        # If no endpoint string exists, return an empty fallback to keep the code from crashing
        if not endpoint:
            logging.warning("AppConfig_Endpoint environment setting is missing.")
            return ""

        try:
            # Prepend https:// if the Terraform string returned a bare hostname
            if not endpoint.startswith("https://"):
                endpoint = f"https://{endpoint}"

            credential = DefaultAzureCredential()
            _app_config_client = AzureAppConfigurationClient(base_url=endpoint, credential=credential)
            logging.info("Successfully instantiated Azure App Configuration client.")
        except Exception as e:
            logging.error(f"Failed to create App Configuration connection: {str(e)}")
            return ""

    # 4. Pull the target value dynamically from your Azure configuration store
    try:
        setting = _app_config_client.get_configuration_setting(key=key_name)
        _cached_settings[key_name] = setting.value
        return setting.value
    except Exception as e:
        logging.error(f"Error fetching runtime key '{key_name}' from cloud: {str(e)}")
        return ""

def get_credential():
    """Provides a lazy-loaded, singleton Azure credential instance."""
    global _azure_credential
    if _azure_credential is None:
        _azure_credential = DefaultAzureCredential()
    return _azure_credential

def get_token_provider():
    """Provides a lazy-loaded token provider for Azure OpenAI authentication."""
    global _token_provider
    if _token_provider is None:
        # Flex Consumption handles the underlying credential scopes natively on demand
        _token_provider = get_bearer_token_provider(
            get_credential(), 
            "https://cognitiveservices.azure.com/.default"
        )
    return _token_provider
