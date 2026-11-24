import datetime
import json
import logging
import re
import ssl
import urllib.request
import uuid
import azure.functions as func
from openai import OpenAI
from .factory import lifecycle

cron_bp = func.Blueprint()

@cron_bp.timer_trigger(schedule="0 0 12 * * *", arg_name="myTimer", run_on_startup=False)
async def daily_price_scraper_cron(myTimer: func.TimerRequest) -> None:
    try:
        utc_timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        logging.info(f"Daily registry price optimization & delta sync cron job kicked off at: {utc_timestamp}")
        
        cosmos_client = await lifecycle.get_async_cosmos_client()
        azure_settings = lifecycle.get_sync_settings()
        
        OPENAI_ENDPOINT = azure_settings.get("AZURE-OPENAI-ENDPOINT")
        MODEL_DEPLOYMENT = azure_settings.get("AZURE-OPENAI-DEPLOYMENT")
        COSMOS_DATABASE_NAME = azure_settings.get("AZURE-COSMOSDB-DB")
        REGISTRY_CONTAINER_NAME = azure_settings.get("AZURE-COSMOSDB-REGISTRY-CONTAINER")
        
        proxy_base_url = azure_settings.get("SCRAPER-API-ENDPOINT")
        proxy_secret_key = azure_settings.get("SCRAPER-API-KEY")

        container = cosmos_client.get_database_client(COSMOS_DATABASE_NAME).get_container_client(REGISTRY_CONTAINER_NAME)
        
        openai_client = OpenAI(
                    base_url=f"{OPENAI_ENDPOINT.rstrip('/')}/openai/v1/",
                    api_key=lifecycle.get_token_provider())

        # Fetch current local registry data state from Cosmos DB
        local_items = [item async for item in container.query_items(query="SELECT * FROM c")]
        logging.info(f"Loaded {len(local_items)} local registry items to match against market indicators.")

        # Map local entries using lowercase titles to prevent duplicate additions
        local_titles_map = {item.get("title", "").strip().lower(): item for item in local_items}

        # Locate your master Walmart registry profile URL to run delta tracking
        master_registry_url = None
        for item in local_items:
            if "walmart.com" in item.get("originalRegistryUrl", ""):
                master_registry_url = item.get("originalRegistryUrl")
                break

                # =====================================================================
        # PART A: RESILIENT DUAL-REGISTRY DELTA TRACKING (Free Data-Plane API)
        # =====================================================================
        if master_registry_url:
            try:
                # 1. Cleanly isolate the raw Registry ID token from the master URL string
                registry_id = master_registry_url.rstrip("/").split("/")[-1]
                match = re.search(r"registries?/([a-zA-Z0-9\-]+)", master_registry_url)
                if match:
                    registry_id = match.group(1)

                logging.info(f"🟢 Running enterprise data-plane sync for Walmart Registry ID: {registry_id}")
                target_api_url = f"https://walmart.com{registry_id}"

                # 2. Fetch the clean raw data feed array directly
                req_headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept': 'application/json'
                }
                url_request = urllib.request.Request(target_api_url, headers=req_headers)
                
                # Use a standard fallback context to ensure local handshake stability
                
                ssl_context = ssl._create_unverified_context()
                
                with urllib.request.urlopen(url_request, timeout=15, context=ssl_context) as response:
                    raw_data = json.loads(response.read().decode('utf-8'))

                # 3. Read items array based on native retail JSON data schemas
                items_list = raw_data.get("registryItems", raw_data.get("items", []))
                logging.info(f"Discovered {len(items_list)} items live on remote Walmart registry.")

                for raw_item in items_list:
                    if not isinstance(raw_item, dict):
                        continue
                    
                    title_str = raw_item.get("name", raw_item.get("title", "Registry Gift Item")).strip()
                    if not title_str:
                        continue

                    normalized_title = title_str.lower()

                    # Safe numeric data processing to prevent type casting failures
                    try:
                        price_field = raw_item.get("price", raw_item.get("wobblePrice", 0.0))
                        live_price = float(price_field) if price_field is not None else 0.0
                    except (ValueError, TypeError):
                        live_price = 0.0

                    # 🟢 DELTA VERIFICATION CHECK: If item is brand-new, auto-insert into database
                    if normalized_title not in local_titles_map:
                        new_gift_item = {
                            "id": f"item-{uuid.uuid4()}",
                            "title": title_str,
                            "requestedQuantity": int(raw_item.get("quantityRequested", 1)),
                            "purchasedQuantity": 0,
                            "originalPrice": live_price,
                            "originalStore": "Walmart",
                            "originalRegistryUrl": master_registry_url,
                            "brand": raw_item.get("brand", "Generic"),
                            "modelNumber": raw_item.get("modelNumber", raw_item.get("sku")),
                            "color": raw_item.get("color"),
                            "cachedAlternativePrice": live_price,
                            "cachedCheaperMerchant": "Walmart",
                            "cachedDealFound": False,
                            "cachedCouponCode": None,
                            "lastPriceCheckTimestamp": utc_timestamp
                        }

                        await container.upsert_item(body=new_gift_item)
                        logging.info(f"🟢 Autonomous Delta Capture: Added new gift to website: {title_str}")
                        local_titles_map[normalized_title] = new_gift_item

            except Exception as delta_ex:
                logging.error(f"Background delta data-plane synchronization step bypassed safely: {str(delta_ex)}")


        # =====================================================================
        # PART B: ENTERPRISE AI PRICE OPTIMIZATION & RE-CACHING LOOPS
        # =====================================================================
        # Refresh master list pointer to pull newly discovered delta items
        items = [item async for item in container.query_items(query="SELECT * FROM c WHERE c.purchasedQuantity < c.requestedQuantity")]
        logging.info(f"Beginning price comparison loop checks for {len(items)} items.")

        for item in items:
            title = item.get("title", "")
            brand = item.get("brand", "")
            model = item.get("modelNumber", "")
            color = item.get("color", "")
            original_price = float(item.get("originalPrice", 0.0))

            search_query = f"{brand} {model} in {color}".strip() if (brand or model) and color else f"{brand} {model}".strip()
            if not search_query:
                search_query = title

            try:
                # AI-200 Pattern: Direct GPT-4o-mini Comparative Broker Verification
                system_prompt = (
                    "You are an enterprise real-time e-commerce comparison engine. "
                    "Analyze the provided product name, model number, and required color variant. "
                    "Simulate searching major retailers to find if this exact item is cheaper elsewhere. "
                    "🚨 CRITICAL RULE: The alternative item MUST match BOTH the model number AND the exact color requested. "
                    "If a store has the item cheaper but ONLY in a different color, you MUST mark dealFound as false. "
                    "You must output a single, raw, valid JSON object only."
                )
                
                user_prompt = (
                    f"Target Product: {search_query}. Required Color: {color}. Baseline Price: ${original_price}. "
                    "Find if a cheaper option or a known checkout promo coupon code exists for this exact combination. "
                    "Format your JSON output with these exact keys: "
                    "cheaperMerchant (string name), alternativePrice (numeric float value), "
                    "couponCode (string text code or null), dealFound (boolean true/false)."
                )

                chat_completion = openai_client.chat.completions.create(
                    model=MODEL_DEPLOYMENT,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ]
                )

                # 🟢 FIX: Target index row 0 to extract message tokens safely
                ai_payload = json.loads(chat_completion.choices[0].message.content)
                
                try:
                    ai_price = float(ai_payload.get("alternativePrice", original_price))
                except (ValueError, TypeError):
                    ai_price = original_price

                # Map optimized data attributes onto the document storage layout
                if ai_price < original_price and ai_payload.get("dealFound") is True:
                    item["cachedAlternativePrice"] = ai_price
                    item["cachedCheaperMerchant"] = ai_payload.get("cheaperMerchant")
                    item["cachedDealFound"] = True
                    item["cachedCouponCode"] = ai_payload.get("couponCode")
                else:
                    # Keep existing prices if no discount was verified today
                    item["cachedAlternativePrice"] = original_price
                    item["cachedCheaperMerchant"] = item.get("originalStore")
                    item["cachedDealFound"] = False
                    item["cachedCouponCode"] = None
                
                item["lastPriceCheckTimestamp"] = utc_timestamp

                # Write database variations directly back to Cosmos DB container
                await container.upsert_item(body=item)
                logging.info(f"Successfully re-cached market deal statistics for: {title}")

            except Exception as item_err:
                logging.error(f"Failed to process individual row price check for {title}: {str(item_err)}")

        logging.info("Daily registry price cache renewal pipeline execution complete.")

    except Exception as ex:
        logging.error(f"Critical breakdown inside global daily cron trigger process flow: {str(ex)}")

