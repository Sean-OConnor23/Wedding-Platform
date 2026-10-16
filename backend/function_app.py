import azure.functions as func
from Routes.faq_assistant import assistant_bp
from Routes.photo_portal import portal_bp
# from Routes.check_photo_status import status_bp #broken
# from Routes.get_invite import rsvp_bp #broken
# from Routes.get_photos import gallery_bp #broken
# from Routes.get_registry import registry_bp #broken
# from Routes.registry_scraper_cron import cron_bp #broken
from Routes.sync_registry_link import sync_link_bp
# from Triggers.photo_processor import photo_processor_bp
# from Triggers.photo_deleter import photo_deleter_bp

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

app.register_blueprint(assistant_bp)
app.register_blueprint(portal_bp)
#app.register_blueprint(status_bp)
#app.register_blueprint(rsvp_bp)
#app.register_blueprint(gallery_bp)
#app.register_blueprint(registry_bp)
#app.register_blueprint(cron_bp)
app.register_blueprint(sync_link_bp)

#app.register_blueprint(photo_processor_bp)
#app.register_blueprint(photo_deleter_bp)
