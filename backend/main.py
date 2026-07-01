"""
NotebookLM Local — Backend Entry Point
Starts the FastAPI server with uvicorn.
"""

import logging
import sys
from pathlib import Path

# Add backend directory to path for clean imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn
from config.settings import get_settings


def setup_logging(level: str = "info") -> None:
    """Configure application logging."""
    log_level = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )
    # Quiet noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def main() -> None:
    """Start the backend server."""
    settings = get_settings()
    setup_logging(settings.log_level)

    logger = logging.getLogger(__name__)
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Listening on http://{settings.host}:{settings.port}")

    uvicorn.run(
        "api.app:create_app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        factory=True,
        log_level=settings.log_level,
        access_log=settings.debug,
    )


if __name__ == "__main__":
    main()
