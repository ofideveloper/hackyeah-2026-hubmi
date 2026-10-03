import logging
import sys

from ..config import get_settings

LOG_FORMAT = "%(asctime)s %(levelname)-7s [%(name)s] %(message)s"
ROOT_LOGGER = "app"


def setup_logging() -> None:
    """Konfiguruje logger `app` (stdout) — uvicorn sam z siebie nie pokazuje INFO aplikacji."""
    root = logging.getLogger(ROOT_LOGGER)
    if root.handlers:
        return  # reload uvicorna / ponowny import
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT, datefmt="%H:%M:%S"))
    root.addHandler(handler)
    root.setLevel(get_settings().log_level.upper())
    root.propagate = False


def get_logger(name: str) -> logging.Logger:
    """`get_logger(__name__)` — moduły spoza pakietu `app` trafiają pod `app.*`."""
    if name != ROOT_LOGGER and not name.startswith(f"{ROOT_LOGGER}."):
        name = f"{ROOT_LOGGER}.{name}"
    setup_logging()
    return logging.getLogger(name)
