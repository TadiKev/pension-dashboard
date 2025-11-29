# api/middleware.py
import time
import uuid
import asyncio
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse
from typing import Callable
from collections import defaultdict
from contextvars import ContextVar

# request_id contextvar for logging
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="unknown")

MAX_BODY_BYTES = 200_000  # 200 KB (adjust)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 60     # requests per window per client

# in-memory rate store: ip -> (count, window_start)
_rate_store = defaultdict(lambda: {"count": 0, "window_start": 0})
_rate_lock = asyncio.Lock()

class RequestIDLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        rid = str(uuid.uuid4())
        request_id_ctx.set(rid)
        request.state.request_id = rid
        # Basic structured log (start)
        request.app.logger.info("request.start", extra={"request_id": rid, "path": request.url.path, "method": request.method})
        try:
            response = await call_next(request)
        finally:
            request.app.logger.info("request.end", extra={"request_id": rid, "path": request.url.path, "method": request.method, "status_code": getattr(response, "status_code", None)})
        return response

class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        # Try Content-Length first
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_BODY_BYTES:
                    return JSONResponse({"detail": "Request body too large"}, status_code=413)
            except ValueError:
                pass
        # Also stream-check the body to defend against missing header
        body = await request.body()
        if len(body) > MAX_BODY_BYTES:
            return JSONResponse({"detail": "Request body too large"}, status_code=413)
        # recreate request stream if body consumed (Starlette specifics)
        async def receive():
            return {"type": "http.request", "body": body}
        request._receive = receive  # monkeypatch receive; OK in middleware context
        return await call_next(request)

class SimpleRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        client_ip = request.client.host if request.client else "unknown"
        now = int(time.time())
        async with _rate_lock:
            entry = _rate_store[client_ip]
            if now - entry["window_start"] >= RATE_LIMIT_WINDOW:
                entry["window_start"] = now
                entry["count"] = 0
            entry["count"] += 1
            if entry["count"] > RATE_LIMIT_MAX:
                return JSONResponse({"detail": "Too many requests"}, status_code=429)
        return await call_next(request)
