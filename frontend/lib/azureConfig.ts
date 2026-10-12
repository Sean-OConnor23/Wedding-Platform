import { DefaultAzureCredential } from "@azure/identity";
import { AppConfigurationClient, parseSecretReference } from "@azure/app-configuration";
import { SecretClient, parseKeyVaultSecretIdentifier } from "@azure/keyvault-secrets";

let configCache: Record<string, string> | null = null;

export async function getAzureSecrets() {
  if (configCache) return configCache;

  // Uses local Azure CLI identity during development
  const credential = new DefaultAzureCredential();
  const endpoint = process.env.AZURE_APPCONFIG_ENDPOINT || "";
   const client = new AppConfigurationClient(endpoint, credential);

   const targetKeys = [
    "LOGIN-GOOGLE-CLIENT-ID",
    "LOGIN-GOOGLE-SECRET",
    "LOGIN-FACEBOOK-APP-ID",
    "LOGIN-FACEBOOK-SECRET",
    "LOGIN-NEXTAUTH-SECRET"
  ];

  const fetched: Record<string, string> = {};

  for (const key of targetKeys) {
    try {
      const setting = await client.getConfigurationSetting({ key });

      // 1. Detect if the App Configuration key holds an explicit Key Vault Secret Reference pointer
      if (setting.value && setting.contentType?.includes("keyvaultref")) {
        // Extract the Key Vault Secret URI metadata payload cleanly
        const secretRef = parseSecretReference(setting as any);
        const secretUrl = secretRef.value.secretId;

        // 2. Parse out the target secret name and raw vault url endpoints
        const { name: secretName, vaultUrl } = parseKeyVaultSecretIdentifier(secretUrl);

        // 3. Authenticate against the specific key vault and fetch the value keylessly
        const secretClient = new SecretClient(vaultUrl, credential);
        const secretBundle = await secretClient.getSecret(secretName);
        
        fetched[key] = secretBundle.value || "";
      } else {
        // Standard non-sensitive public identifier text handling
        fetched[key] = setting.value || "";
      }
    } catch (error) {
      console.error(`Failed to pull or decrypt Azure configuration key: ${key}`, error);
      fetched[key] = "";
    }
  }

  configCache = fetched;
  return fetched;
}