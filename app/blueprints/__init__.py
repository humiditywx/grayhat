from .api import api_bp
from .auth import auth_bp
from .docs import docs_bp
from .pages import pages_bp
from .admin import admin_bp

__all__ = ['api_bp', 'auth_bp', 'docs_bp', 'pages_bp', 'admin_bp']
