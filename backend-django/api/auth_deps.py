# actuarial-fastapi/api/auth_deps.py
import os
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt

security = HTTPBearer()

SECRET = (
    os.environ.get("FASTAPI_JWT_SECRET")
    or os.environ.get("DJANGO_SECRET_KEY")
    or "please-change-me"
)
ALGORITHM = os.environ.get("FASTAPI_JWT_ALG", "HS256")


def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Dependency to verify Bearer token (JWT) and return payload.
    Raises 401 if invalid.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
