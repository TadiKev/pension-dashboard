# actuarial-fastapi/api/auth_deps.py
import os
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

JWT_SIGNING_KEY = os.environ.get("SIMPLE_JWT_SIGNING_KEY") or os.environ.get("DJANGO_SECRET_KEY") or "dev-secret"
ALGORITHM = os.environ.get("SIMPLE_JWT_ALGORITHM", "HS256")

def verify_jwt(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Simple dependency to verify HS256 JWT issued by Django SimpleJWT.
    Returns decoded payload dict on success or raises HTTPException(401).
    """
    token = creds.credentials
    try:
        payload = jwt.decode(token, JWT_SIGNING_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
