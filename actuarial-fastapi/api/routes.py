# actuarial-fastapi/api/routes.py
from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File, status
from fastapi.responses import JSONResponse
from typing import Any, Dict, List, Optional
import logging
from decimal import Decimal, InvalidOperation
import csv
from io import TextIOWrapper
import os

# pensionlib imports (thin wrappers)
from pensionlib.calculations import (
    project_dc_account,
    project_db_accrual,
    annuity_conversion,
    commutation,
    apply_withdrawal,
    early_retirement_adjustment,
    late_retirement_adjustment,
)
from pensionlib import models as pension_models

# local deps
from . import deps
from . import schemas

# auth dependency - verify_jwt should raise HTTPException(401) when not valid.
# We also support a development mode where auth is optional.
from .auth_deps import verify_jwt  # must exist and raise HTTPException on invalid token

router = APIRouter()
logger = logging.getLogger(__name__)

# helper to decide if auth is required (useful for local dev).
FASTAPI_AUTH_REQUIRED = os.environ.get("FASTAPI_AUTH_REQUIRED", "1") not in ("0", "false", "False", "no")


async def maybe_verify_jwt(token_payload: Optional[dict] = Depends(verify_jwt)) -> Optional[dict]:
    """
    Wrapper dependency: when FASTAPI_AUTH_REQUIRED is False, allow missing/invalid tokens
    (verify_jwt will have already raised on invalid token), but if env says auth not required and
    no token was provided, return None.
    This assumes verify_jwt returns None if no Authorization header present; adapt if your verify_jwt raises.
    """
    if FASTAPI_AUTH_REQUIRED:
        # enforce: if verify_jwt returned None or was not called, raise a clear error
        if token_payload is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token")
        return token_payload
    # auth optional in dev: return whatever we received (possibly None)
    return token_payload


# -----------------------
# DC endpoints
# -----------------------
@router.post("/dc/project", response_model=schemas.DCResponse, summary="Project DC account", tags=["dc"])
async def dc_project(
    req: schemas.DCRequest,
    token_payload: Optional[dict] = Depends(maybe_verify_jwt),
    request_id: str = Depends(deps.get_request_id),
):
    """
    Project a Defined Contribution account using pensionlib's DCProjectionInput.
    Requires a valid JWT unless FASTAPI_AUTH_REQUIRED=0 (dev).
    """
    try:
        inp = pension_models.DCProjectionInput(
            current_balance=req.current_balance,
            annual_salary=req.annual_salary,
            contribution_rate=req.assumptions.contribution_rate,
            salary_growth=req.assumptions.salary_growth,
            rate_of_return=req.assumptions.rate_of_return,
            years=req.years,
            accrual_frequency=getattr(req, "accrual_frequency", 1),
        )
    except Exception as e:
        logger.exception("dc_project.input_validation_failed", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid input: {e}")

    logger.info("dc_project.request", extra={"request_id": request_id, "years": req.years})
    try:
        out = await deps.run_pensionlib(project_dc_account, inp)
    except Exception as exc:
        logger.exception("dc_project.runtime_error", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Projection engine error: {exc}")

    logger.info("dc_project.done", extra={"request_id": request_id})
    # out is expected to match schemas.DCResponse (pydantic model will validate)
    return out


# -----------------------
# DB accrual
# -----------------------
@router.post("/db/accrual", response_model=schemas.DBResponse, summary="Compute DB accrual", tags=["db"])
async def db_accrual(
    req: schemas.DBRequest,
    token_payload: Optional[dict] = Depends(maybe_verify_jwt),
    request_id: str = Depends(deps.get_request_id),
):
    try:
        inp = pension_models.DBAccrualInput(
            final_salary=req.final_salary,
            years_of_service=req.years_of_service,
            accrual_rate=req.accrual_rate,
        )
    except Exception as e:
        logger.exception("db_accrual.input_validation_failed", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid input: {e}")

    try:
        out = await deps.run_pensionlib(project_db_accrual, inp)
    except Exception as exc:
        logger.exception("db_accrual.runtime_error", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return out


# -----------------------
# Annuity conversion
# -----------------------
@router.post("/annuity/convert", response_model=schemas.AnnuityResponse, summary="Convert lump sum to annuity", tags=["annuity"])
async def annuity_convert(
    req: schemas.AnnuityRequest,
    token_payload: Optional[dict] = Depends(maybe_verify_jwt),
    request_id: str = Depends(deps.get_request_id),
):
    try:
        inp = pension_models.AnnuityInput(
            lump_sum=req.lump_sum,
            rate_of_return=req.rate_of_return,
            payment_periods=req.payment_periods,
            payment_frequency_per_year=req.payment_frequency_per_year,
        )
    except Exception as e:
        logger.exception("annuity_convert.input_validation_failed", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid input: {e}")

    try:
        out = await deps.run_pensionlib(annuity_conversion, inp)
    except Exception as exc:
        logger.exception("annuity_convert.runtime_error", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return out


# -----------------------
# Commutation
# -----------------------
@router.post("/commutation", summary="Commutation (annuity percent to lump)", tags=["misc"])
async def commutation_endpoint(
    payload: Dict[str, Any] = Body(..., example={"annuity_payment": "1000.00", "commutation_pct": "0.10"}),
    token_payload: Optional[dict] = Depends(maybe_verify_jwt),
    request_id: str = Depends(deps.get_request_id),
):
    try:
        annuity_payment = Decimal(str(payload["annuity_payment"]))
        commutation_pct = Decimal(str(payload["commutation_pct"]))
    except (KeyError, InvalidOperation, ValueError) as e:
        logger.exception("commutation.invalid_payload", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid payload: {e}")

    try:
        lump = await deps.run_pensionlib(commutation, annuity_payment, commutation_pct)
    except Exception as exc:
        logger.exception("commutation.runtime_error", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return {"lump_sum": lump}


# -----------------------
# Withdrawal
# -----------------------
@router.post("/withdraw", summary="Apply withdrawal to DC balance", tags=["misc"])
async def withdraw_endpoint(
    payload: Dict[str, Any] = Body(..., example={"balance": "1000.00", "withdrawal_amt": "200.00"}),
    token_payload: Optional[dict] = Depends(maybe_verify_jwt),
    request_id: str = Depends(deps.get_request_id),
):
    try:
        balance = Decimal(str(payload["balance"]))
        withdrawal_amt = Decimal(str(payload["withdrawal_amt"]))
    except (KeyError, InvalidOperation, ValueError) as e:
        logger.exception("withdraw.invalid_payload", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid payload: {e}")

    try:
        new_balance = await deps.run_pensionlib(apply_withdrawal, balance, withdrawal_amt)
    except Exception as exc:
        logger.exception("withdraw.runtime_error", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return {"new_balance": new_balance}


# -----------------------
# Early / Late adjustments
# -----------------------
@router.post("/adjustments/early", summary="Early retirement adjustment", tags=["adjustments"])
async def early_adjust(
    payload: Dict[str, Any] = Body(..., example={"annual_pension": "10000.00", "years_early": 2, "pct_per_year": "0.05"}),
    token_payload: Optional[dict] = Depends(maybe_verify_jwt),
    request_id: str = Depends(deps.get_request_id),
):
    try:
        annual_pension = Decimal(str(payload["annual_pension"]))
        years_early = int(payload["years_early"])
        pct_per_year = Decimal(str(payload.get("pct_per_year", "0.05")))
    except (KeyError, InvalidOperation, ValueError) as e:
        logger.exception("early_adjust.invalid_payload", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid payload: {e}")

    try:
        adjusted = await deps.run_pensionlib(early_retirement_adjustment, annual_pension, years_early, pct_per_year)
    except Exception as exc:
        logger.exception("early_adjust.runtime_error", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return {"adjusted_pension": adjusted}


@router.post("/adjustments/late", summary="Late retirement adjustment", tags=["adjustments"])
async def late_adjust(
    payload: Dict[str, Any] = Body(..., example={"annual_pension": "10000.00", "years_late": 3, "pct_per_year": "0.02"}),
    token_payload: Optional[dict] = Depends(maybe_verify_jwt),
    request_id: str = Depends(deps.get_request_id),
):
    try:
        annual_pension = Decimal(str(payload["annual_pension"]))
        years_late = int(payload["years_late"])
        pct_per_year = Decimal(str(payload.get("pct_per_year", "0.02")))
    except (KeyError, InvalidOperation, ValueError) as e:
        logger.exception("late_adjust.invalid_payload", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid payload: {e}")

    try:
        adjusted = await deps.run_pensionlib(late_retirement_adjustment, annual_pension, years_late, pct_per_year)
    except Exception as exc:
        logger.exception("late_adjust.runtime_error", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return {"adjusted_pension": adjusted}


# -----------------------
# Batch CSV endpoint
# -----------------------
@router.post("/batch/dc_project", tags=["batch"])
async def batch_dc_project(
    file: UploadFile = File(...),
    token_payload: Optional[dict] = Depends(maybe_verify_jwt),
    request_id: str = Depends(deps.get_request_id),
):
    """
    Accept CSV upload (multipart/form-data 'file') with columns:
    current_balance, annual_salary, years, contribution_rate, salary_growth, rate_of_return
    Returns list of projection outputs and per-row errors when present.
    """
    # guard: ensure uploaded file present
    if file is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file uploaded")

    results: List[Dict[str, Any]] = []
    processed = 0

    # Use TextIOWrapper and csv.DictReader; ensure correct encoding
    try:
        # Important: file.file is a SpooledTemporaryFile / BufferedReader
        text_stream = TextIOWrapper(file.file, encoding="utf-8", errors="replace")
        reader = csv.DictReader(text_stream)
    except Exception as e:
        logger.exception("batch_dc_project.file_read_error", extra={"request_id": request_id})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to read CSV: {e}")

    # iterate rows
    for idx, row in enumerate(reader, start=1):
        processed += 1
        # defensive: required fields check
        try:
            years_val = int(row.get("years", "").strip() or 0)
            inp = pension_models.DCProjectionInput(
                current_balance=row.get("current_balance"),
                annual_salary=row.get("annual_salary"),
                contribution_rate=row.get("contribution_rate"),
                salary_growth=row.get("salary_growth"),
                rate_of_return=row.get("rate_of_return"),
                years=years_val,
                accrual_frequency=1,
            )
        except Exception as e:
            logger.warning("batch_dc_project.invalid_row", extra={"request_id": request_id, "row_index": idx, "error": str(e)})
            results.append({"row_index": idx, "row": row, "error": f"invalid input: {e}"})
            continue

        try:
            out = await deps.run_pensionlib(project_dc_account, inp)
            results.append({"row_index": idx, "result": out})
        except Exception as exc:
            logger.exception("batch_dc_project.runtime_error", extra={"request_id": request_id, "row_index": idx})
            results.append({"row_index": idx, "row": row, "error": f"projection failed: {exc}"})

    return JSONResponse({"count": processed, "results": results})
