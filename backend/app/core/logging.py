import logging

from app.settings import settings

FORMAT = "%(asctime)s - %(name)s:%(levelname)s - %(message)s"
ISO_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def configure_logging() -> None:
    level = logging._nameToLevel.get(settings.logger_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format=FORMAT,
        datefmt=ISO_DATE_FORMAT,
    )

    # optional file handler
    if settings.logger_file:
        file_handler = logging.FileHandler(settings.logger_file)
        file_handler.setFormatter(logging.Formatter(fmt=FORMAT, datefmt=ISO_DATE_FORMAT))
        logging.getLogger().addHandler(file_handler)
