terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    azuread = {
      source = "hashicorp/azuread"
    }
  }
}

provider "azurerm" {
  features {}
}

data "azurerm_resource_group" "existing_rg" {
  name = "Wedding-Platform"
}

data "azurerm_storage_account" "existing_storage" {
  name                = "weddingplatstorage"
  resource_group_name = data.azurerm_resource_group.existing_rg.name
}

data "azurerm_app_configuration" "existing_config" {
  name                = "wedding-plat-appconfig"
  resource_group_name = "Wedding-Platform"
}

# 1. Create the Entra ID Application Registration
resource "azuread_application" "pipeline_app" {
  display_name = "wedding-platform-pipeline-sp"
}

# 2. Create the associated Service Principal
resource "azuread_service_principal" "pipeline_sp" {
  client_id = azuread_application.pipeline_app.client_id
}

# 3. Establish the Federated OIDC Identity Link for GitHub Actions (Main Branch)
resource "azuread_application_federated_identity_credential" "github_oidc" {
  application_id = azuread_application.pipeline_app.id
  display_name   = "github-actions-main-branch"
  description    = "OIDC trust connection for GitHub Actions deployment pipeline"
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://githubusercontent.com"

  # Replace with your exact repository context mapping string
  subject = "Wedding-Platform:Sean-OConnor23/WeddingPlatform:ref:refs/heads/main"
}

# 4. Grant Contributor permissions exclusively to your target Resource Group
resource "azurerm_role_assignment" "pipeline_contributor" {
  scope                = data.azurerm_resource_group.existing_rg.id
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.pipeline_sp.object_id
}

# Create the Linux Consumption Plan (Serverless Billing Model)
resource "azurerm_service_plan" "function_plan" {
  name                = "wedding-function-plan"
  resource_group_name = data.azurerm_resource_group.existing_rg.name
  location            = data.azurerm_resource_group.existing_rg.location
  os_type             = "Linux"
  sku_name            = "Y1" # Free/Serverless consumption tier
}

resource "azurerm_application_insights" "app_insights" {
  name                = "wedding-api-prod-insights"
  location            = data.azurerm_resource_group.existing_rg.location # Match your resource group location
  resource_group_name = data.azurerm_resource_group.existing_rg.name
  application_type    = "web"
}

# Create the Live Python Function App Instance linked to your existing storage
resource "azurerm_linux_function_app" "backend_api" {
  name                = "wedding-api-prod-server" # Must be unique across all of Azure
  resource_group_name = data.azurerm_resource_group.existing_rg.name
  location            = data.azurerm_resource_group.existing_rg.location

  storage_account_name       = data.azurerm_storage_account.existing_storage.name
  storage_account_access_key = data.azurerm_storage_account.existing_storage.primary_access_key
  service_plan_id            = azurerm_service_plan.function_plan.id

  site_config {
    application_stack {
      python_version = "3.11"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  # Terraform automatically pulls connection strings securely directly out of your data block
  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"              = "python"
    "AzureWebJobsStorage"                   = data.azurerm_storage_account.existing_storage.primary_connection_string
    "AzureWebJobsFeatureFlags"              = "EnableWorkerIndexing"
    "SCM_DO_BUILD_DURING_DEPLOYMENT"        = "true"
    "ENABLE_ORYX_BUILD"                     = "true"
    "AppConfig_Endpoint"                    = data.azurerm_app_configuration.existing_config.endpoint
    "APPINSIGHTS_INSTRUMENTATIONKEY"        = azurerm_application_insights.app_insights.instrumentation_key
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.app_insights.connection_string

    #Need to check to see if we actually need this or if we can just use the AzureWebJobsStorage connection string
    "AZURE_STORAGE_CONNECTION_STRING" = data.azurerm_storage_account.existing_storage.primary_connection_string
  }
}

# Provision the Azure Static Web App (Frontend Hosting)
resource "azurerm_static_web_app" "frontend_ui" {
  name                = "wedding-platform-ui"
  resource_group_name = data.azurerm_resource_group.existing_rg.name
  location            = "westus2"
  sku_tier            = "Standard"
  sku_size            = "Standard"
}

resource "azurerm_role_assignment" "appconfig_reader" {
  scope                = data.azurerm_app_configuration.existing_config.id
  role_definition_name = "App Configuration Data Reader"

  # Clean standard syntax now that the cloud identity exists
  principal_id = azurerm_linux_function_app.backend_api.identity[0].principal_id
}

# Output the SWA key directly to the terminal for your GitHub Secrets
output "static_web_app_deployment_token" {
  value     = azurerm_static_web_app.frontend_ui.api_key
  sensitive = true
}

data "azurerm_client_config" "current" {}

output "AZURE_CLIENT_ID" {
  description = "The Application (Client) ID of the OIDC Service Principal"
  value       = azuread_application.pipeline_app.client_id
}

output "AZURE_TENANT_ID" {
  description = "The Azure Active Directory Tenant ID"
  value       = data.azurerm_client_config.current.tenant_id
}

output "AZURE_SUBSCRIPTION_ID" {
  description = "The Azure Subscription ID"
  value       = data.azurerm_client_config.current.subscription_id
}
