import logging
import os
import sys

# 1. Initialize logging at the absolute top of the execution flow
logging.basicConfig(level=logging.INFO)

# 2. Force the current directory into sys.path to resolve relative import layers on Linux
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# 3. Wrap ALL blueprint and utility imports to catch silent startup crashes
try:
    import azure.functions as func
    from Routes.faq_assistant import assistant_bp
    from Routes.photo_portal import portal_bp
    from Routes.check_photo_status import status_bp
    from Routes.get_invite import rsvp_bp
    from Routes.get_photos import gallery_bp
    from Routes.get_registry import registry_bp
    from Routes.registry_scraper_cron import cron_bp
    from Routes.sync_registry_link import sync_link_bp
    from Triggers.photo_processor import photo_processor_bp
    from Triggers.photo_deleter import photo_deleter_bp
    from Utils.config import initialize_cloud_config
except Exception as e:
    logging.critical("!!!! CRITICAL IMPORT CRASH DURING MOUNT SCAN !!!!")
    logging.exception(e)
    raise e

# 4. Initialize cloud configurations
try:
    initialize_cloud_config()
except Exception as e:
    logging.critical(f"CRITICAL STARTUP ERROR in initialize_cloud_config: {str(e)}")
    raise e

# 5. Initialize the core Function App instance
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# 6. Register routing blueprints
app.register_blueprint(assistant_bp)
app.register_blueprint(portal_bp)
app.register_blueprint(status_bp)
app.register_blueprint(rsvp_bp)
app.register_blueprint(gallery_bp)
app.register_blueprint(registry_bp)
app.register_blueprint(cron_bp)
app.register_blueprint(sync_link_bp)

# 7. Register trigger blueprints
app.register_blueprint(photo_processor_bp)
app.register_blueprint(photo_deleter_bp)
