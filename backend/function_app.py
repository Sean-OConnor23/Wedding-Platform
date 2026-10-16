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

try:
    initialize_cloud_config()
except Exception as e:
    import logging
    # This forces the exact error message into your log stream
    logging.critical(f"CRITICAL STARTUP ERROR in initialize_cloud_config: {str(e)}")
    raise e

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

app.register_blueprint(assistant_bp)
app.register_blueprint(portal_bp)
app.register_blueprint(status_bp)
app.register_blueprint(rsvp_bp)
app.register_blueprint(gallery_bp)
app.register_blueprint(registry_bp)
app.register_blueprint(cron_bp)
app.register_blueprint(sync_link_bp)

app.register_blueprint(photo_processor_bp)
app.register_blueprint(photo_deleter_bp)