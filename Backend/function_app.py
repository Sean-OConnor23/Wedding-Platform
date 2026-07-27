import azure.functions as func
from Routes.faq_assistant import assistant_bp
from Routes.photo_portal import portal_bp
from Routes.photo_processor import processor_bp
from Utils.config import initialize_cloud_config

initialize_cloud_config()

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

app.register_blueprint(assistant_bp)
app.register_blueprint(portal_bp)
app.register_blueprint(processor_bp)