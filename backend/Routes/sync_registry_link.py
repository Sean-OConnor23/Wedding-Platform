# Routes/sync_registry_link.py
import azure.functions as func
import json
import logging
import urllib.request
import urllib.parse
import uuid
from Utils.config import get_setting, get_credential
from openai import AzureOpenAI
from azure.cosmos import CosmosClient

sync_link_bp = func.Blueprint()

@sync_link_bp.route(route="sync-registry-link", methods=["POST"])
def sync_registry_link(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("Executing production enterprise-grade registry ingestion workflow.")

    try:
        body = req.get_json()
        target_url = body.get("url", "").strip()
        store_name = body.get("storeName", "External Retailer").strip()

        if not target_url:
            return func.HttpResponse(
                json.dumps({"error": "Missing target resource URL parameter"}),
                status_code=400, mimetype="application/json"
            )

        # Pull system configurations keylessly from central config
        openai_endpoint = get_setting("AZURE-OPENAI-ENDPOINT")
        model_deployment = get_setting("AZURE-OPENAI-DEPLOYMENT", "gpt-4o-mini")
        COSMOS_DB_ENDPOINT = get_setting("AZURE-COSMOSDB-ENDPOINT")
        COSMOS_DATABASE_NAME = get_setting("AZURE-COSMOSDB-DB")
        REGISTRY_CONTAINER_NAME = get_setting("AZURE-COSMOSDB-REGISTRY-CONTAINER", "Registry")
        
        # Pull proxy mapping parameters keylessly
        proxy_base_url = get_setting("SCRAPER-API-ENDPOINT")
        proxy_secret_key = get_setting("SCRAPER-API-KEY")

        cosmos_client = CosmosClient(url=COSMOS_DB_ENDPOINT, credential=get_credential())
        container = cosmos_client.get_database_client(COSMOS_DATABASE_NAME).get_container_client(REGISTRY_CONTAINER_NAME)

        # Single-scope token provider to prevent the multi-resource AzureCliCredential crash
        def single_scope_token_provider() -> str:
            token_obj = get_credential().get_token("https://azure.com")
            return token_obj.token

        openai_client = AzureOpenAI(
            azure_endpoint=openai_endpoint,
            azure_ad_token_provider=single_scope_token_provider,
            api_version="2024-02-01"
        )

        page_text = ""
        
        # 🟢 LIVE ROUTING LAYER: Route the request cleanly through ScraperAPI US Residential Nodes
        if proxy_base_url and proxy_secret_key:
            try:
                logging.info(f"Routing live crawl through ScraperAPI US Residential Nodes: {target_url}")
                encoded_target = urllib.parse.quote_plus(target_url)
                
                # Enforce routing through standard US geolocated proxy pools to bypass anti-bot gates
                authenticated_request_url = (
                    f"{proxy_base_url.rstrip('/')}/"
                    f"?api_key={proxy_secret_key.strip()}"
                    f"&url={encoded_target}"
                    f"&render=true"
                    f"&country_code=us"
                )
                
                req_headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
                url_request = urllib.request.Request(authenticated_request_url, headers=req_headers)
                
                with urllib.request.urlopen(url_request, timeout=50) as response:
                    raw_html = response.read().decode('utf-8', errors='ignore')
                
                page_text = " ".join(raw_html.split())[:20000]
                logging.info(f"ScraperAPI successfully bypassed firewalls. Ingested {len(page_text)} bytes.")
            except Exception as proxy_ex:
                logging.error(f"ScraperAPI Gateway connection failed: {str(proxy_ex)}")
                return func.HttpResponse(
                    json.dumps({"error": f"External proxy pipeline connection fault: {str(proxy_ex)}"}),
                    status_code=502, mimetype="application/json"
                )
        else:
            return func.HttpResponse(
                json.dumps({"error": "Proxy configuration missing from local.settings.json"}),
                status_code=500, mimetype="application/json"
            )

        # 🤖 AI-200 Processing: Clean, structured dynamic list extraction
        system_prompt = (
            "You are an enterprise data parsing engine. Analyze the provided webpage text markup "
            "representing a wedding registry wishlist. Isolate ALL independent product items listed under areas like 'Still Needed'. "
            "Ignore overall page banners or registry header titles. Extract only actual gift item values. "
            "Output a single, clean, valid JSON object containing an array of items."
        )
        
        user_prompt = (
            f"Webpage Content: {page_text}\n\n"
            "Extract every distinct product. For each item, capture:\n"
            "1. title (Clean descriptive item name)\n"
            "2. originalPrice (Numeric float value)\n"
            "3. brand (Manufacturer company name)\n"
            "4. modelNumber (Model code SKU or null)\n"
            "5. color (The specific variant color or null)\n\n"
            "Output format must be: { \"items\": [ { \"title\": \"...\", \"originalPrice\": 0.0, \"brand\": \"...\", \"modelNumber\": \"...\", \"color\": \"...\" } ] }"
        )

        chat_completion = openai_client.chat.completions.create(
            model=model_deployment,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )

        ai_payload = json.loads(chat_completion.choices.message.content)
        extracted_items = ai_payload.get("items", [])

        synced_count = 0
        for item_data in extracted_items:
            title_str = item_data.get("title", "").strip()
            if not title_str or "registry" in title_str.lower() or "platform" in title_str.lower():
                continue
                
            try:
                price_val = float(item_data.get("originalPrice", 0.0))
            except (ValueError, TypeError):
                price_val = 0.0

            new_registry_item = {
                "id": f"item-{uuid.uuid4()}",
                "title": title_str,
                "requestedQuantity": 1,
                "purchasedQuantity": 0,
                "originalPrice": price_val,
                "originalStore": store_name,
                "originalRegistryUrl": target_url,
                "brand": item_data.get("brand", "Generic"),
                "modelNumber": item_data.get("modelNumber"),
                "color": item_data.get("color"),
                "cachedAlternativePrice": price_val,
                "cachedCheaperMerchant": store_name,
                "cachedDealFound": False,
                "cachedCouponCode": None
            }

            container.upsert_item(body=new_registry_item)
            synced_count += 1

        return func.HttpResponse(
            json.dumps({"success": True, "message": f"Successfully parsed and saved {synced_count} items from live page."}), 
            status_code=200, mimetype="application/json"
        )

    except Exception as ex:
        logging.error(f"Production link ingestion failure: {str(ex)}")
        return func.HttpResponse(
            json.dumps({"error": f"Failed to compile production registry data stream: {str(ex)}"}),
            status_code=500, mimetype="application/json"
        )
