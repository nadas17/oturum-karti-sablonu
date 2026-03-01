# app.py
"""
Flask uygulama factory.
Kullanım: python app.py  veya  python start.py
"""
import json
import os

from flask import Flask

from api.routes import bp as api_bp
from config import get_config


def create_app(env: str = None) -> Flask:
    if env is None:
        env = os.environ.get("FLASK_ENV", "production")

    config = get_config(env)
    app = Flask(__name__, static_folder="static", static_url_path="/")
    app.config["APP_CONFIG"] = config
    with open(config.FIELD_MAP_PATH, encoding="utf-8") as f:
        app.config["FIELD_MAP"] = json.load(f)

    app.register_blueprint(api_bp)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_react(path):
        """React SPA — tüm rotaları index.html'e yönlendir."""
        static_index = os.path.join(app.static_folder, "index.html")
        if os.path.exists(static_index):
            return app.send_static_file("index.html")
        return (
            "<h2>Frontend build edilmedi.</h2>"
            "<p>Çalıştır: <code>cd frontend && npm run build</code></p>",
            503,
        )

    return app


if __name__ == "__main__":
    env = os.environ.get("FLASK_ENV", "production")
    config = get_config(env)
    app = create_app(env)
    print(f"  Polonya Form Araci calisiyor: http://localhost:{config.PORT}")
    app.run(host="0.0.0.0", port=config.PORT, debug=config.DEBUG)
