import os
import logging
from azure.identity import DefaultAzureCredential
from azure.appconfiguration.provider import load

_config_provider = None
_credential = None

def _initialize_config():
    global _config_provider, _credential
    
    if _config_provider is not None:
        return

    try:
        _credential = DefaultAzureCredential()
        endpoint = os.environ.get("AZURE_APP_CONFIG_ENDPOINT")
        
        if not endpoint:
            logging.warning("AZURE_APP_CONFIG_ENDPOINT not found in environment. Falling back to local OS settings.")
            return

        logging.info(f"Connecting to Azure App Configuration endpoint: {endpoint}")
        
        # Version-independent fallback to resolve Key Vault configuration secrets references
        def secret_resolver(secret_uri):
            from azure.keyvault.secrets import SecretClient
            # Parses the raw secret URL reference cleanly
            parts = secret_uri.split('/secrets/')
            vault_url = parts[0]
            secret_name = parts[1].split('/')[0]
            
            client = SecretClient(vault_url=vault_url, credential=_credential)
            return client.get_secret(secret_name).value

        _config_provider = load(
            endpoint=endpoint,
            credential=_credential,
            secret_resolver=secret_resolver,
            refresh_interval=300  
        )
        logging.info("Successfully loaded data mapping from App Configuration.")
        
    except Exception as ex:
        logging.error(f"Critical failure initializing cloud configurations: {str(ex)}")
        raise

def get_credential():
    _initialize_config()
    if not _credential:
        return DefaultAzureCredential()
    return _credential

def get_setting(key_name: str) -> str:
    _initialize_config()
    
    if _config_provider and key_name in _config_provider:
        return _config_provider[key_name]
        
    value = os.environ.get(key_name)
    if value:
        return value
        
    logging.warning(f"Configuration key '{key_name}' could not be resolved.")
    return ""

def get_token_provider():
    from azure.identity import DefaultAzureCredential
    cred = DefaultAzureCredential()
    return cred.get_token("https://azure.com").token
