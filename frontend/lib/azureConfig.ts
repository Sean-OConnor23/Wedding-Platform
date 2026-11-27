import {
  ClientSecretCredential,
  AzureCliCredential,
  TokenCredential,
} from "@azure/identity";
import {
  AppConfigurationClient,
  parseSecretReference,
} from "@azure/app-configuration";
import {
  SecretClient,
  parseKeyVaultSecretIdentifier,
} from "@azure/keyvault-secrets";

interface CachedSecrets {
  data: Record<string, string>;
  expiresAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let secretCache: CachedSecrets | null = null;
let inFlightFetch: Promise<Record<string, string>> | null = null;

function getCredential(): TokenCredential {
  if (process.env.NODE_ENV === "production") {
    const tenantId = process.env.AZURE_TENANT_ID?.trim();
    const clientId = process.env.AZURE_CLIENT_ID?.trim();
    const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();

    if (!tenantId || !clientId || !clientSecret) {
      throw new Error(
        "Missing AZURE_TENANT_ID, AZURE_CLIENT_ID, or AZURE_CLIENT_SECRET in production."
      );
    }

    return new ClientSecretCredential(tenantId, clientId, clientSecret);
  }

  return new AzureCliCredential();
}

export async function getAzureSecrets(): Promise<Record<string, string>> {
  const now = Date.now();

  // Return valid cached secrets
  if (secretCache && now < secretCache.expiresAt) {
    return secretCache.data;
  }

  // Deduplicate concurrent cold-start requests
  if (inFlightFetch) {
    return inFlightFetch;
  }

  inFlightFetch = (async () => {
    const endpoint = process.env.AZURE_APPCONFIG_ENDPOINT?.trim();
    if (!endpoint) {
      throw new Error("AZURE_APPCONFIG_ENDPOINT is not configured.");
    }

    const credential = getCredential();
    const appConfigClient = new AppConfigurationClient(endpoint, credential);

    const targetKeys = [
      "LOGIN-GOOGLE-CLIENT-ID",
      "LOGIN-GOOGLE-SECRET",
      "LOGIN-FACEBOOK-APP-ID",
      "LOGIN-FACEBOOK-SECRET",
      "LOGIN-NEXTAUTH-SECRET",
    ];

    const fetched: Record<string, string> = {};

    for (const key of targetKeys) {
      const setting = await appConfigClient.getConfigurationSetting({ key });

      if (setting.value && setting.contentType?.includes("keyvaultref")) {
        const secretRef = parseSecretReference(setting as any);
        const { name: secretName, vaultUrl } = parseKeyVaultSecretIdentifier(
          secretRef.value.secretId
        );

        const secretClient = new SecretClient(vaultUrl, credential);
        const secretBundle = await secretClient.getSecret(secretName);

        if (!secretBundle.value) {
          throw new Error(`Key Vault secret '${secretName}' is empty.`);
        }
        fetched[key] = secretBundle.value;
      } else {
        if (!setting.value) {
          throw new Error(`App Configuration key '${key}' is empty.`);
        }
        fetched[key] = setting.value;
      }
    }

    secretCache = {
      data: fetched,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return fetched;
  })();

  try {
    return await inFlightFetch;
  } finally {
    inFlightFetch = null;
  }
}
