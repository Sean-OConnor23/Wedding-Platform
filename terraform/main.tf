terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
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

# Create the Linux Consumption Plan (Serverless Billing Model)
resource "azurerm_service_plan" "function_plan" {
  name                = "wedding-function-plan"
  resource_group_name = data.azurerm_resource_group.existing_rg.name
  location            = data.azurerm_resource_group.existing_rg.location
  os_type             = "Linux"
  sku_name            = "Y1" # Free/Serverless consumption tier
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
    cors {
      allowed_origins = ["https://brave-desert-0c2c2030f.1.azurestaticapps.net"] # Will restrict to your frontend domain post-deployment
    }
  }

  # Terraform automatically pulls connection strings securely directly out of your data block
  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"        = "python"
    "AZURE_STORAGE_CONNECTION_STRING" = data.azurerm_storage_account.existing_storage.primary_connection_string
  }
}

# Provision the Azure Static Web App (Frontend Hosting)
resource "azurerm_static_web_app" "frontend_ui" {
  name                = "wedding-platform-ui"
  resource_group_name = data.azurerm_resource_group.existing_rg.name
  location            = "eastus2"
  sku_tier            = "Free"
  sku_size            = "Free"
}

# Output the SWA key directly to the terminal for your GitHub Secrets
output "static_web_app_deployment_token" {
  value     = azurerm_static_web_app.frontend_ui.api_key
  sensitive = true
}
