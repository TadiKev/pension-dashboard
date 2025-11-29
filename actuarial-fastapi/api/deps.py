# actuarial-fastapi/api/deps.py
"""
Dependency helpers for the actuarial-fastapi service.

Provides:
- get_request_id(): simple UUID request id dependency
- run_pensionlib(): run CPU-bound pensionlib code in threadpool
- get_simple_logger(): convenience for routes/tests (optional)
"""

import asyncio
import functools
import logging
import uuid
from typing import Any, Callable

logger = logging.getLogger("pensionlib_api.deps")


def get_request_id() -> str:
    """
    Dependency that returns a unique request id (UUID hex string).
    Use in routes like:
        request_id: str = Depends(deps.get_request_id)
    """
    return uuid.uuid4().hex


async def run_pensionlib(fn: Callable[..., Any], *args, **kwargs) -> Any:
    """
    Run a synchronous / blocking pensionlib function in the default threadpool and return result.

    Example:
        out = await deps.run_pensionlib(project_dc_account, inp)

    This prevents blocking the async event loop for CPU-bound or blocking calls.
    """
    loop = asyncio.get_running_loop()
    call = functools.partial(fn, *args, **kwargs)
    try:
        result = await loop.run_in_executor(None, call)
        return result
    except Exception:
        logger.exception("run_pensionlib.failed")
        # re-raise so the route can map this to HTTP 500/502 as appropriate
        raise


def get_simple_logger(name: str = "pensionlib_api"):
    """
    Convenience: small wrapper that returns a configured logger for use in modules/routes.
    Not strictly required — you can import logging.getLogger directly.
    """
    return logging.getLogger(name)
