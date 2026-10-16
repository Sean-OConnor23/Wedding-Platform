import logging
import json
import azure.functions as func
from openai import AzureOpenAI
from azure.search.documents import SearchClient
from Utils.config import get_setting, get_credential, get_token_provider

assistant_bp = func.Blueprint()

@assistant_bp.route(route="ask-assistant", methods=["POST"])
def ask_assistant(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Processing a live grounded RAG query via blueprint.')
    
    openai_endpoint = get_setting("AZURE-OPENAI-ENDPOINT")
    model_deployment = get_setting("AZURE-OPENAI-DEPLOYMENT")
    search_endpoint = get_setting("AZURE-SEARCH-ENDPOINT")
    search_index = get_setting("AZURE-SEARCH-INDEX")

    # Open Routes/faq_assistant.py and update line 21 with a clean fallback string:
    system_prompt = get_setting("WEDDING-FAQ-CONTEXT") or "You are a helpful wedding coordinator AI assistant. Use the provided context to answer guest questions accurately."

    if not openai_endpoint or not search_endpoint:
        return func.HttpResponse(
            json.dumps({
                "error": "Configuration Loading Error",
                "details": "The settings dictionary is empty. Double check your cloud AppConfig network configuration."
            }),
            status_code=500,
            mimetype="application/json"
        )

    try:
        req_body = req.get_json()
        guest_question = req_body.get('question')
        if not guest_question:
            return func.HttpResponse(
                json.dumps({"error": "Please provide a 'question' in the request body."}),
                status_code=400,
                mimetype="application/json"
            )
        
        search_client = SearchClient(
            endpoint=search_endpoint,
            index_name=search_index,
            credential=get_credential()
        )

        openai_client = AzureOpenAI(
                    azure_endpoint=openai_endpoint,
                    azure_ad_token_provider=get_token_provider(),
                    api_version="2024-02-01"
                )

        search_results = search_client.search(
            search_text=guest_question,
            top=3
        )
        
        retrieved_context = ""
        for result in search_results:
            retrieved_context += f"\n- {result['content']}"
            
        if not retrieved_context:
            retrieved_context = "No specific wedding documents found matching this query."

        # STEP TWO: Inject context into the LLM system prompt
        system_instruction = f"{system_prompt}--- CONTEXT TO USE ---\n{retrieved_context}"
        
        # Determine the correct key name based on your deployment model type
        system_key = "instruction" if ("o1" in model_deployment or "o3" in model_deployment) else "content"

        # Build your messages array with completely valid dictionary syntax
        messages_payload = [
            {"role": "system", system_key: system_instruction},
            {"role": "user", "content": guest_question}
        ]

        # STEP THREE: Send the augmented prompt to the model deployment
        response = openai_client.chat.completions.create(
            model=model_deployment,
            messages=messages_payload,
            temperature=1 if ("o1" in model_deployment or "o3" in model_deployment) else 0.3,
            max_completion_tokens=250
        )
        
        ai_reply = response.choices[0].message.content
        
        return func.HttpResponse(
            json.dumps({"reply": ai_reply, "context_used": retrieved_context}),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Blueprint RAG Process Failure: {str(e)}")
        import traceback
        return func.HttpResponse(
            json.dumps({
                "error": "Failed to generate a response from the AI backend.",
                "details": str(e),
                "traceback": traceback.format_exc()
            }),
            status_code=500,
            mimetype="application/json"
        )
