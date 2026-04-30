from __future__ import annotations

import os

from flask import Blueprint, current_app, send_from_directory

docs_bp = Blueprint('docs', __name__, url_prefix='/docs')

_SWAGGER_UI_VERSION = '5.18.2'
_CDN = f'https://unpkg.com/swagger-ui-dist@{_SWAGGER_UI_VERSION}'

_HTML = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pentastic API Docs</title>
  <link rel="stylesheet" type="text/css" href="{_CDN}/swagger-ui.css">
  <link rel="icon" type="image/png" href="{_CDN}/favicon-32x32.png" sizes="32x32">
  <link rel="icon" type="image/png" href="{_CDN}/favicon-16x16.png" sizes="16x16">
  <style>
    html {{
      box-sizing: border-box;
      overflow-y: scroll;
    }}

    *,
    *:before,
    *:after {{
      box-sizing: inherit;
    }}

    body {{
      margin: 0;
      background: #fafafa;
    }}
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="{_CDN}/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="{_CDN}/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = function () {{
      window.ui = SwaggerUIBundle({{
        url: "/docs/openapi.yaml",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset,
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl,
        ],
        layout: "StandaloneLayout",
        withCredentials: true,
        requestInterceptor: function (req) {{
          var match = document.cookie.match(/(?:^|;\\s*)csrf_access_token=([^;]+)/);
          if (match) {{
            req.headers["X-CSRF-TOKEN"] = decodeURIComponent(match[1]);
          }}
          return req;
        }},
      }});
    }};
  </script>
</body>
</html>
'''


@docs_bp.get('/', strict_slashes=False)
def swagger_ui():
    return _HTML, 200, {'Content-Type': 'text/html; charset=utf-8'}


@docs_bp.get('/openapi.yaml')
def openapi_spec():
    static_dir = os.path.join(current_app.root_path, 'static', 'swagger')
    return send_from_directory(static_dir, 'openapi.yaml', mimetype='application/yaml')
