import azure.functions as func
from Routes.faq_assistant import assistant_bp
from Routes.photo_portal import portal_bp
from Routes.photo_processor import processor_bp

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

app.register_blueprint(assistant_bp)
app.register_blueprint(portal_bp)
app.register_blueprint(processor_bp)