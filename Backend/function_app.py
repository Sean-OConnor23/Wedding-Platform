import azure.functions as func
import logging
import json
import os
from openai import AzureOpenAI
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient

# Initialize the Azure Functions App
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# 1. Initialize the Azure OpenAI Client
openai_client = AzureOpenAI(
    azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT"),
    api_key=os.environ.get("AZURE_OPENAI_KEY"),
    api_version="2024-02-01" # Clean, widely supported stable release version
)
model_deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT")

# 2. Initialize the Azure AI Search Client
search_client = SearchClient(
    endpoint=os.environ.get("AZURE_SEARCH_ENDPOINT"),
    index_name="wedding-index",
    credential=AzureKeyCredential(os.environ.get("AZURE_SEARCH_KEY"))
)

@app.route(route="ask-assistant", methods=["POST"])
def ask_assistant(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing a live grounded RAG query.')

    try:
        # Parse the incoming request payload
        req_body = req.get_json()
        guest_question = req_body.get('question')
        
        if not guest_question:
            return func.HttpResponse(
                json.dumps({"error": "Please provide a 'question' in the request body."}), 
                status_code=400,
                mimetype="application/json"
            )
        
        # STEP ONE OF RAG: Query Azure AI Search to retrieve relevant context
        logging.info(f"Querying AI Search for: {guest_question}")
        search_results = search_client.search(
            search_text=guest_question,
            top=1 # Grab the single most relevant document snippet
        )
        
        # Extract the text content from the search results
        retrieved_context = ""
        for result in search_results:
            retrieved_context += f"\n- {result['content']}"
            
        if not retrieved_context:
            retrieved_context = "No specific wedding documents found matching this query."

        logging.info(f"Retrieved Cloud Context: {retrieved_context}")

        # STEP TWO OF RAG: Inject context into the LLM system prompt
        system_instruction = (
            "You are an enthusiastic AI wedding assistant. Answer the guest's question "
            "using ONLY the factual Context provided below. If the answer cannot be found "
            "in the context, politely say that you do not have that specific information yet.\n\n"
            f"--- CONTEXT TO USE ---\n{retrieved_context}"
        )

        # STEP THREE OF RAG: Send the augmented prompt to the model deployment
        response = openai_client.chat.completions.create(
            model=model_deployment,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": guest_question}
            ],
            temperature=0.3, # Lower temperature makes the model stick strictly to facts
            max_completion_tokens=250 # Modern parameter supporting latest model snapshots
        )

        ai_reply = response.choices[0].message.content

        # Return the final response with tracing metadata
        return func.HttpResponse(
            json.dumps({
                "reply": ai_reply, 
                "context_used": retrieved_context
            }),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as e:
        logging.error(f"!!! CRITICAL BACKEND EXCEPTION !!!")
        logging.error(str(e))
        return func.HttpResponse(
            json.dumps({
                "error": "Failed to generate a response from the AI backend.", 
                "raw_details": str(e)
            }), 
            status_code=500,
            mimetype="application/json"
        )
