# Wedding-Platform
This is the website I have created for my upcoming wedding. It utilizes a variety of Azure Services that I have learned about while completing my AI-200 certification.

## Azure Services Used:
1. Azure OpenAI (Foundry)
2. Azure AI Search (Free Tier)
3. Azure Functions (Serverless Microservices Compute)
4. Azure Resource Groups

## Architecture Visualization
```
                        ┌───────────────────────────┐
                        │   WEDDING WEBSITE UI      │
                        │ (Azure Static Web Apps)   │
                        └─────┬───────────────┬─────┘
                              │               │
       HTTP POST /ask-assistant               │ HTTP POST /upload-image
       (Real-time JSON Chat)  │               │ (Binary Image Stream)
                              ▼               ▼
 ┌────────────────────────────────────┐ ┌────────────────────────────────────┐
 │  1. CONVERSATIONAL MICROSERVICE   │ │      2. PHOTO PORTAL MICROSERVICE   │
 │       (Azure Function App)         │ │         (Azure Function App)       │
 ├────────────────────────────────────┤ ├────────────────────────────────────┤
 │                                    │ │                                    │
 │       [ Azure Function ]           │ │       [ Azure Function ]           │
 │               │                    │ │        (Ingest Gatekeeper)         │
 │     Search query                   │ │                │                   │
 │               ▼                    │ │          Stream file               │
 │       [ Azure AI Search ]          │ │                ▼                   │
 │               │                    │ │       [ Azure Blob Storage ]       │
 │         Return facts               │ │                │                   │
 │               ▼                    │ │      Fire async event              │
 │       [ Azure Function ]           │ │                ▼                   │
 │               │                    │ │       [ Azure Function ]           │
 │      Augmented prompt              │ │       (Background Worker)          │
 │               ▼                    │ │                │                   │
 │       [ Azure OpenAI ]             │ │          Scan image                │
 │       (gpt-4o-mini)                │ │                ▼                   │
 │               │                    │ │       [ Azure AI Vision ]          │
 │               ▼                    │ │     (Moderation & Metadata)        │
 │       Natural Response             │ │                                    │
 └───────────────┬────────────────────┘ └────────────────────────────────────┘
                 │                                       
                 └───────────────► [ WEBSITE UI ] ◄──────┘
                            (Updates screen for guest)
```

## Activity Log
#### July 14
- I setup the initial backend project structure. Within this, I have used Python Virtual Environment (.venv) alongside the Azure Functions Python V2 Programming Model. Currently, I utilize the local.settings.json file paired with a Python .gitignore to store app secrets.
- Through Azure AI Search, I created a database schema index to outline wedding specific faqs. I inserted temporary placeholders for proof of concept. This is where my wedding platform and model will retrieve the data necessary to interact with a user.
- With Azure AI Foundry, I deployed a gpt-5.4-model and an exposed endpoint to allow the user to interact. (Using Data Zone Standard deployment).
- All of this is contained in one Azure Resource Group so I can isolate resources used and easily manage costs and other things under one sole umbrella.
- Overall:  My Azure Functions app acts as the middleman between Azure AI Foundry and Azure Search. A user prompts a question which then gets sent to Azure Search. Azure Search uses vector indexing and information provided to return (to Azure Function App) information it deems relevant to the question. From there, this data is passed into Azure AI Foundry where a user-friendly response is generated and passed back to Azure Function for display to the user. 

## To Do List:
- Move keys/configurations from local.settings.json to Azure Configuration/Azure Key Vault
- Asynchronous Photo Portal
