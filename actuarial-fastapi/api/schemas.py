# api/schemas.py
from pydantic import BaseModel, Field
from decimal import Decimal
from typing import List, Optional

class Assumptions(BaseModel):
    rate_of_return: Decimal = Field(..., description="Annual rate of return (decimal), e.g., 0.05")
    salary_growth: Decimal = Field(..., description="Annual salary growth (decimal), e.g., 0.03")
    contribution_rate: Decimal = Field(..., description="Contribution rate (decimal), e.g., 0.08")
    retirement_age: Optional[int] = None

# DC
class DCRequest(BaseModel):
    current_balance: Decimal
    annual_salary: Decimal
    assumptions: Assumptions
    years: int = Field(..., ge=0)

class YearBalance(BaseModel):
    year: int
    salary: Decimal
    contribution: Decimal
    balance: Decimal

class DCResponse(BaseModel):
    initial_balance: Decimal
    annual_balances: List[YearBalance]
    final_balance: Decimal

# DB accrual
class DBRequest(BaseModel):
    final_salary: Decimal
    years_of_service: int = Field(..., ge=0)
    accrual_rate: Decimal

class DBResponse(BaseModel):
    annual_accrual: Decimal
    total_pension: Decimal

# Annuity
class AnnuityRequest(BaseModel):
    lump_sum: Decimal
    rate_of_return: Decimal
    payment_periods: int = Field(..., ge=1)
    payment_frequency_per_year: int = Field(12, ge=1)

class AnnuityResponse(BaseModel):
    periodic_payment: Decimal
    annuity_factor: Decimal
