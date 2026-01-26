"""에이전트 추론 과정 로깅."""
import logging
import sys


def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """에이전트/도구용 로거 생성."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(level)
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        formatter = logging.Formatter(
            "%(asctime)s | %(name)s | %(levelname)s | %(message)s"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger
