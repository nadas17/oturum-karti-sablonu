# config.py
import os

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    PORT: int = 5000
    DEBUG: bool = False
    PDF_TEMPLATE_PATH: str = os.path.join(
        BASE_DIR, "assets",
        "wniosek-o-udzielenie-cudzoziemcowi-zezwolenia-na-pobyt-czasow.pdf"
    )
    FIELD_MAP_PATH: str = os.path.join(BASE_DIR, "assets", "form_field_map_v3.json")
    LLAMAPARSE_API_KEY: str = os.environ.get("LLAMAPARSE_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")


class DevConfig(Config):
    DEBUG: bool = True


def get_config(env: str = "production") -> Config:
    return DevConfig() if env == "development" else Config()
