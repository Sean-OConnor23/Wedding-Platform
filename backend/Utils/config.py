import os
import logging
from datetime import timedelta
from azure.identity import DefaultAzureCredential
from azure.appconfiguration.provider import load

# Global variables to cache the configuration provider and credentials
_config_provider = None
_credential = None

def _initialize_config():
    """Initializes the Azure credential and configuration mapping."""
    global _config_provider, _credential
    
    if _config_provider is not None:
        return

    try:
        # Automatically detects AZURE_CLIENT_ID in production 
        # or uses 'az login' credentials during local debugging
        _credential = DefaultAzureCredential()
        
        # Read the bootstrapping variable injected from the Function App environment
        endpoint = os.environ.get("AZURE_APP_CONFIG_ENDPOINT")
        
        if not endpoint:
            # Fallback for bare-minimum local testing if env variables aren't injected yet
            logging.warning("AZURE_APP_CONFIG_ENDPOINT not found in environment. Falling back to local OS settings.")
            return

        logging.info(f"Connecting to Azure App Configuration endpoint: {endpoint}")
        
        # Load all configurations and dynamically resolve linked Key Vault secrets
        _config_provider = load(
            endpoint=endpoint,
            credential=_credential,
            refresh_interval=timedelta(minutes=5) # Caches configurations to stay within free/standard tier limits
        )
        logging.info("Successfully loaded data mapping from App Configuration.")
        
    except Exception as ex:
        logging.error(f"Critical failure initializing cloud configurations: {str(ex)}")
        raise

def get_credential():
    """Returns the authenticated DefaultAzureCredential token manager."""
    _initialize_config()
    if not _credential:
        return DefaultAzureCredential()
    return _credential

def get_setting(key_name: str) -> str:
    """
    Fetches a setting value. Looks up the value in Azure App Configuration first.
    Falls back to a standard local environment variable if the cloud provider isn't initialized.
    """
    _initialize_config()
    
    # 1. Production Path: Attempt to read from the initialized cloud map
    if _config_provider and key_name in _config_provider:
        return _config_provider[key_name]
        
    # 2. Local Fallback Path: Read directly from local.settings.json or OS environment
    value = os.environ.get(key_name)
    if value:
        return value
        
    logging.warning(f"Configuration key '{key_name}' could not be resolved in cloud provider or local workspace environment variables.")
    return ""
