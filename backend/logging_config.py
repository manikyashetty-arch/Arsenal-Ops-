"""
Logging configuration for Arsenal Ops Backend
Provides centralized logging setup for all modules
"""

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

# On Render (and other PaaS), stdout is captured and persisted by the platform.
# Skip the file handler in that environment to avoid filling ephemeral disks.
ON_RENDER = bool(os.environ.get("RENDER"))

# Create logs directory only when we plan to write a file
LOG_DIR = Path(__file__).parent / "logs"
if not ON_RENDER:
    LOG_DIR.mkdir(exist_ok=True)

# Single consolidated log file for all modules
LOG_FILE = LOG_DIR / "backend.log"

# Define log levels and format
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """
    Set up a logger with both file and console handlers
    All modules log to the same consolidated file.

    On Render the file handler is skipped (stdout is captured by the platform).
    Otherwise the file handler uses RotatingFileHandler so a single dev session
    can't fill the disk.

    Args:
        name: Logger name (typically __name__)
        level: Logging level (default: INFO)

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Avoid duplicate handlers if logger already configured
    if logger.hasHandlers():
        return logger

    # Console handler (for development/debugging)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    # File handler (rotating; skipped on Render where stdout is captured)
    if not ON_RENDER:
        file_handler = RotatingFileHandler(LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=5)
        file_handler.setLevel(logging.DEBUG)  # Always log DEBUG and above to file
        file_formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)

    return logger


# Example usage at module level
logger = setup_logger("arsenal_ops")
