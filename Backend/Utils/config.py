# Utils/config.py
import os
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from azure.appconfiguration.provider import load, AzureAppConfigurationKeyVaultOptions

# Shared global dictionary placeholder
settings = {}
credential = DefaultAzureCredential()
token = get_bearer_token_provider(
    credential, 
    "https://cognitiveservices.azure.com/.default"
)

def initialize_cloud_config():
    global settings
    settings.clear()
    
    app_config_endpoint = os.environ.get("AppConfig_Endpoint")
    if not app_config_endpoint:
        print("Warning: AppConfig_Endpoint environment variable is missing from terminal!")
        return
        
    try:
        kv_options = AzureAppConfigurationKeyVaultOptions(credential=credential)
        
        loaded_provider = load(
            endpoint=app_config_endpoint, 
            credential=credential,
            key_vault_options=kv_options
        )
        
        settings.update(loaded_provider)
        print("All cloud configurations and Key Vault credentials synced successfully.")
        
    except Exception as e:
        print(f"\nCLOUD INITIALIZATION FAILED: {str(e)}")
