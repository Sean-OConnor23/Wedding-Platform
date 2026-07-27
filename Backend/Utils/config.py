# Utils/config.py
import os
from azure.identity import DefaultAzureCredential
from azure.appconfiguration.provider import load, AzureAppConfigurationKeyVaultOptions

# Shared global dictionary placeholder
settings = {}

def initialize_cloud_config():
    global settings
    settings.clear()
    
    app_config_endpoint = os.environ.get("AppConfig_Endpoint")
    if not app_config_endpoint:
        print("Warning: AppConfig_Endpoint environment variable is missing from terminal!")
        return
        
    try:
        credential = DefaultAzureCredential()
        
        # Wrap your credential inside the dedicated Key Vault Options object
        kv_options = AzureAppConfigurationKeyVaultOptions(credential=credential)
        
        # Load your cloud configuration map and decrypt Key Vault links natively
        loaded_provider = load(
            endpoint=app_config_endpoint, 
            credential=credential,
            key_vault_options=kv_options
        )
        
        # Save values to your global dictionary
        settings.update(loaded_provider)
        print("All cloud configurations and Key Vault credentials synced successfully.")
        
    except Exception as e:
        print(f"\nCLOUD INITIALIZATION FAILED: {str(e)}")
