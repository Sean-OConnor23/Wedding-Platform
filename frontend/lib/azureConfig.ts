import { DefaultAzureCredential } from "@azure/identity";
import { AppConfigurationClient, parseSecretReference } from "@azure/app-configuration";
import { SecretClient, parseKeyVaultSecretIdentifier } from "@azure/keyvault-secrets";

let configCache: Record<string, string> | null = null;

export async function getAzureSecrets() {
  if (configCache) return configCache;

  const endpoint = process.env.AZURE_APPCONFIG_ENDPOINT;
  if (!endpoint) {
    throw new Error("AZURE_APPCONFIG_ENDPOINT is not defined in SWA Environment Variables.");
  }

  const credential = new DefaultAzureCredential();
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

      if (setting.value && setting.contentType?.includes("keyvaultref")) {
        const secretRef = parseSecretReference(setting as any);
        const secretUrl = secretRef.value.secretId;
        const { name: secretName, vaultUrl } = parseKeyVaultSecretIdentifier(secretUrl);

        const secretClient = new SecretClient(vaultUrl, credential);
        const secretBundle = await secretClient.getSecret(secretName);

        if (!secretBundle.value) {
          throw new Error(`Key Vault secret ${secretName} returned empty.`);
        }
        fetched[key] = secretBundle.value;
      } else {
        if (!setting.value) {
          throw new Error(`App Config setting ${key} returned empty.`);
        }
        fetched[key] = setting.value;
      }
    } catch (error: any) {
      // Throw immediately instead of caching empty strings
      throw new Error(`Failed to load Azure secret '${key}': ${error?.message || error}`);
    }
  }

  configCache = fetched;
  return fetched;
}
