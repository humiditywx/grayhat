from __future__ import annotations

from flask import Blueprint, send_from_directory, current_app
import os

docs_bp = Blueprint('docs', __name__, url_prefix='/docs')

_SWAGGER_UI_VERSION = '5.18.2'
_CDN = f'https://unpkg.com/swagger-ui-dist@{_SWAGGER_UI_VERSION}'

_HTML = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pentastic API Docs</title>
  <link rel="stylesheet" href="{_CDN}/swagger-ui.css" />
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}

    body {{
      background: #0d1117;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }}

    /* ── Top bar ── */
    .topbar {{
      background: #161b22 !important;
      border-bottom: 1px solid #30363d;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 100;
    }}
    .topbar-title {{
      font-size: 18px;
      font-weight: 700;
      color: #e6edf3;
      letter-spacing: -0.3px;
    }}
    .topbar-badge {{
      background: #1f6feb;
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      letter-spacing: 0.4px;
    }}

    /* ── Notice banner ── */
    .auth-notice {{
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 14px 20px;
      margin: 20px 24px 0;
      color: #8b949e;
      font-size: 13px;
      line-height: 1.6;
    }}
    .auth-notice strong {{ color: #e6edf3; }}
    .auth-notice code {{
      background: #21262d;
      border-radius: 4px;
      padding: 1px 5px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      color: #79c0ff;
    }}

    /* ── Swagger wrapper ── */
    #swagger-ui {{
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px 60px;
    }}

    /* ── Swagger UI overrides ── */
    .swagger-ui .topbar {{ display: none !important; }}

    .swagger-ui .info {{
      margin: 28px 0 0 !important;
    }}
    .swagger-ui .info .title {{
      color: #e6edf3 !important;
      font-size: 26px !important;
    }}
    .swagger-ui .info .description {{
      color: #8b949e !important;
    }}
    .swagger-ui .info .description p, .swagger-ui .info .description li {{
      color: #8b949e !important;
    }}
    .swagger-ui .info .description code {{
      background: #21262d;
      border-radius: 4px;
      padding: 1px 5px;
      color: #79c0ff;
    }}
    .swagger-ui .info .description h3 {{
      color: #e6edf3 !important;
      margin: 12px 0 4px !important;
    }}

    .swagger-ui {{
      color: #e6edf3 !important;
    }}
    .swagger-ui .opblock-tag {{
      color: #e6edf3 !important;
      border-bottom: 1px solid #21262d !important;
      font-size: 18px !important;
    }}
    .swagger-ui .opblock-tag:hover {{
      background: #161b22 !important;
    }}
    .swagger-ui .opblock {{
      border-radius: 8px !important;
      margin: 6px 0 !important;
      border: 1px solid #30363d !important;
      background: #161b22 !important;
    }}
    .swagger-ui .opblock .opblock-summary {{
      border-radius: 7px !important;
    }}
    .swagger-ui .opblock.opblock-get .opblock-summary-method  {{ background: #1f6feb !important; }}
    .swagger-ui .opblock.opblock-post .opblock-summary-method {{ background: #238636 !important; }}
    .swagger-ui .opblock.opblock-patch .opblock-summary-method {{ background: #9a6700 !important; }}
    .swagger-ui .opblock.opblock-delete .opblock-summary-method {{ background: #b62324 !important; }}
    .swagger-ui .opblock.opblock-put .opblock-summary-method  {{ background: #7d4e00 !important; }}

    .swagger-ui .opblock .opblock-summary-path {{ color: #e6edf3 !important; font-family: "SFMono-Regular", Consolas, monospace !important; }}
    .swagger-ui .opblock .opblock-summary-description {{ color: #8b949e !important; font-style: normal !important; }}
    .swagger-ui .opblock-body {{ background: #0d1117 !important; }}
    .swagger-ui .opblock-section-header {{ background: #0d1117 !important; border-top: 1px solid #21262d !important; }}
    .swagger-ui .opblock-section-header h4 {{ color: #8b949e !important; }}

    .swagger-ui table thead tr th {{ background: #161b22 !important; color: #8b949e !important; border-bottom: 1px solid #30363d !important; }}
    .swagger-ui table tbody tr td {{ background: #0d1117 !important; color: #e6edf3 !important; border-bottom: 1px solid #21262d !important; }}
    .swagger-ui .parameter__name {{ color: #79c0ff !important; }}
    .swagger-ui .parameter__type {{ color: #56d364 !important; }}
    .swagger-ui .parameter__in  {{ color: #d2a8ff !important; }}

    .swagger-ui .btn {{ border-radius: 6px !important; }}
    .swagger-ui .btn.execute  {{ background: #1f6feb !important; color: #fff !important; border-color: #1f6feb !important; }}
    .swagger-ui .btn.cancel   {{ background: transparent !important; color: #e6edf3 !important; border-color: #30363d !important; }}
    .swagger-ui .btn.try-out__btn {{ border-color: #30363d !important; color: #8b949e !important; }}
    .swagger-ui .btn.try-out__btn:hover {{ border-color: #1f6feb !important; color: #79c0ff !important; }}

    .swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5 {{ color: #8b949e !important; }}
    .swagger-ui .response-col_status {{ color: #56d364 !important; }}
    .swagger-ui .highlight-code {{ background: #0d1117 !important; border: 1px solid #21262d !important; border-radius: 6px !important; }}
    .swagger-ui .microlight {{ color: #e6edf3 !important; }}

    .swagger-ui .model-box {{ background: #161b22 !important; border: 1px solid #30363d !important; border-radius: 6px !important; }}
    .swagger-ui .model-title {{ color: #e6edf3 !important; }}
    .swagger-ui .model {{ color: #e6edf3 !important; }}
    .swagger-ui .prop-type {{ color: #79c0ff !important; }}
    .swagger-ui .prop-format {{ color: #56d364 !important; }}

    .swagger-ui input[type=text], .swagger-ui textarea, .swagger-ui select {{
      background: #21262d !important;
      color: #e6edf3 !important;
      border: 1px solid #30363d !important;
      border-radius: 6px !important;
    }}
    .swagger-ui input[type=text]:focus, .swagger-ui textarea:focus {{
      border-color: #1f6feb !important;
      outline: none !important;
    }}

    .swagger-ui .scheme-container {{
      background: #161b22 !important;
      border: 1px solid #30363d !important;
      border-radius: 8px !important;
      padding: 16px !important;
      margin-bottom: 16px !important;
    }}
    .swagger-ui select {{ padding: 6px 10px !important; }}

    .swagger-ui .auth-wrapper {{ background: #161b22 !important; border: 1px solid #30363d !important; border-radius: 8px !important; }}
    .swagger-ui .auth-container {{ color: #e6edf3 !important; }}
    .swagger-ui .auth-container h4 {{ color: #e6edf3 !important; }}
    .swagger-ui .auth-container .wrapper {{ background: #0d1117 !important; }}
    .swagger-ui .dialog-ux .modal-ux {{ background: #161b22 !important; border: 1px solid #30363d !important; border-radius: 10px !important; }}
    .swagger-ui .dialog-ux .modal-ux-header {{ background: #21262d !important; border-bottom: 1px solid #30363d !important; }}
    .swagger-ui .dialog-ux .modal-ux-header h3 {{ color: #e6edf3 !important; }}

    .swagger-ui .scopes h2 {{ color: #8b949e !important; }}
    .swagger-ui .servers > label span {{ color: #8b949e !important; }}

    .swagger-ui section.models {{ border: 1px solid #30363d !important; border-radius: 8px !important; }}
    .swagger-ui section.models h4 {{ color: #e6edf3 !important; border-bottom: 1px solid #30363d !important; }}
    .swagger-ui section.models.is-open h4 {{ border-bottom: 1px solid #30363d !important; }}

    .swagger-ui .markdown p {{ color: #8b949e !important; }}
    .swagger-ui .markdown code {{ background: #21262d !important; color: #79c0ff !important; border-radius: 4px !important; padding: 1px 5px !important; }}
    .swagger-ui .renderedMarkdown p {{ color: #8b949e !important; }}
    .swagger-ui .renderedMarkdown code {{ background: #21262d !important; color: #79c0ff !important; border-radius: 4px !important; padding: 1px 5px !important; }}

    .swagger-ui .response-control-media-type__accept-message {{ color: #56d364 !important; }}

    ::-webkit-scrollbar {{ width: 8px; background: #0d1117; }}
    ::-webkit-scrollbar-thumb {{ background: #30363d; border-radius: 4px; }}
    ::-webkit-scrollbar-thumb:hover {{ background: #484f58; }}
  </style>
</head>
<body>
  <div class="topbar">
    <span class="topbar-title">Pentastic API</span>
    <span class="topbar-badge">v1.0.0</span>
  </div>

  <div class="auth-notice">
    <strong>How to authenticate:</strong>
    Expand <code>auth → POST /api/auth/login</code>, click <strong>Try it out</strong>, enter your credentials, and execute.
    The JWT cookie is set automatically. For mutating requests (POST / PATCH / DELETE) the
    <code>X-CSRF-TOKEN</code> header is injected automatically from the <code>csrf_access_token</code> cookie —
    no manual setup needed.
  </div>

  <div id="swagger-ui"></div>

  <script src="{_CDN}/swagger-ui-bundle.js"></script>
  <script src="{_CDN}/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {{
      SwaggerUIBundle({{
        url: "/docs/openapi.yaml",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset,
        ],
        layout: "StandaloneLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 2,
        docExpansion: "list",
        filter: true,
        tryItOutEnabled: false,
        withCredentials: true,

        // Auto-inject CSRF token from cookie on every mutating request
        requestInterceptor: function (req) {{
          var match = document.cookie.match(/(?:^|;\\s*)csrf_access_token=([^;]+)/);
          if (match) {{
            req.headers['X-CSRF-TOKEN'] = decodeURIComponent(match[1]);
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
