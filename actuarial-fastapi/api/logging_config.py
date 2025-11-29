# api/logging_config.py
import logging
from pythonjsonlogger import jsonlogger

def configure_logging():
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    # JSON formatter
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter('%(asctime)s %(name)s %(levelname)s %(request_id)s %(message)s')
    handler.setFormatter(formatter)
    logger.handlers = [handler]
