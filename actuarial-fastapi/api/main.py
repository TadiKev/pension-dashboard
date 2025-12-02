# api/main.py
# Run with: uvicorn api.main:app --reload --port 8001
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import datetime

import os
import logging

logger = logging.getLogger("uvicorn.error")
logger.setLevel(logging.INFO)

app = FastAPI()

# CORS - allow your Vite dev server + localhost
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
# if you want to use env var FASTAPI_CORS_ORIGINS (comma-separated) uncomment:
env_origins = os.environ.get("FASTAPI_CORS_ORIGINS")
if env_origins:
    origins = [o.strip() for o in env_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# optional debug middleware that logs Authorization header (safe masking)
@app.middleware("http")
async def auth_debug_middleware(request: Request, call_next):
    try:
        auth = request.headers.get("authorization")
        logger.info(
            f"[AUTH-DBG] {request.method} {request.url.path} Authorization: {'<present>' if auth else '<missing>'}"
        )
        if auth:
            try:
                token = auth.split(None, 1)[1]
            except Exception:
                token = auth
            masked = (
                token
                if not isinstance(token, str)
                else (token[:8] + "..." + token[-8:] if len(token) > 32 else token)
            )
            logger.info(f"[AUTH-DBG] token masked: {masked}")
    except Exception:
        logger.exception("[AUTH-DBG] logging error")
    resp = await call_next(request)
    return resp


# Helper to build a projection from payload
def build_projection(payload: dict):
    try:
        current_balance = float(payload.get("current_balance", 0))
    except Exception:
        current_balance = 0.0
    try:
        annual_salary = float(payload.get("annual_salary", 0))
    except Exception:
        annual_salary = 0.0
    try:
        years = int(payload.get("years", 10))
    except Exception:
        years = 10

    assumptions = payload.get("assumptions", {}) or {}
    try:
        contribution_rate = float(assumptions.get("contribution_rate", 0.1))
    except Exception:
        contribution_rate = 0.1
    try:
        salary_growth = float(assumptions.get("salary_growth", 0.02))
    except Exception:
        salary_growth = 0.02
    try:
        rate_of_return = float(assumptions.get("rate_of_return", 0.05))
    except Exception:
        rate_of_return = 0.05

    start_year = datetime.date.today().year
    balance = round(current_balance, 2)
    salary = round(annual_salary, 2)

    projection = []
    # produce `years + 1` rows (including starting year) — adjust if you prefer exactly `years`
    for i in range(years + 1):
        year_label = str(start_year + i)
        contribution = round(salary * contribution_rate, 2)
        growth = round(balance * rate_of_return, 2)
        balance = round(balance + contribution + growth, 2)
        projection.append(
            {
                "year": year_label,
                "balance": balance,
                "contribution": contribution,
                "growth": growth,
                "salary": salary,
            }
        )
        # bump salary
        salary = round(salary * (1.0 + salary_growth), 2)

    # simple static allocations
    allocations = [
        {"name": "Equities", "value": 60},
        {"name": "Bonds", "value": 25},
        {"name": "Cash", "value": 10},
        {"name": "Other", "value": 5},
    ]

    # simple transactions from first few projection years
    transactions = []
    for idx, row in enumerate(projection[:5]):
        transactions.append(
            {
                "id": idx + 1,
                "date": f"{row['year']}-06-30",
                "type": "contribution",
                "amount": row["contribution"],
            }
        )

    return projection, allocations, transactions


@app.post("/v1/dc/project")
async def dc_project(payload: dict):
    """
    Accepts JSON payload like:
    {
      "current_balance":"10000.00",
      "annual_salary":"40000.00",
      "years": 10,
      "assumptions": { "contribution_rate": "0.10", "salary_growth": "0.02", "rate_of_return": "0.05" }
    }
    Returns: { projection: [...], allocations: [...], transactions: [...] }
    """
    logger.info("dc_project payload: %s", payload)
    projection, allocations, transactions = build_projection(payload)

    # return in the exact shape the frontend normalizeResponse() expects:
    return JSONResponse(
        content={
            "projection": projection,
            "allocations": allocations,
            "transactions": transactions,
            "ok": True,
            "source": "fastapi",
        }
    )
