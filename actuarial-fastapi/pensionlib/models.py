from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
from typing import List

class DCProjectionInput(BaseModel):
    current_balance: Decimal
    annual_salary: Decimal
    contribution_rate: Decimal  # decimal (0.08 == 8%)
    salary_growth: Decimal
    rate_of_return: Decimal
    years: int = Field(..., ge=0)
    accrual_frequency: int = Field(1, ge=1)

    @field_validator("contribution_rate", "salary_growth", "rate_of_return", mode="before")
    def _to_decimal(cls, v):
        return Decimal(str(v))

    @field_validator("contribution_rate")
    def _check_contribution(cls, v):
        if v < 0 or v > 1:
            raise ValueError("contribution_rate must be between 0 and 1 (decimal)")
        return v

class YearBalance(BaseModel):
    year: int
    salary: Decimal
    contribution: Decimal
    balance: Decimal

class DCProjectionOutput(BaseModel):
    initial_balance: Decimal
    annual_balances: List[YearBalance]
    final_balance: Decimal

class DBAccrualInput(BaseModel):
    final_salary: Decimal
    years_of_service: int = Field(..., ge=0)
    accrual_rate: Decimal

    @field_validator("accrual_rate", mode="before")
    def _to_decimal_accrual(cls, v):
        return Decimal(str(v))

class DBAccrualOutput(BaseModel):
    annual_accrual: Decimal
    total_pension: Decimal

class AnnuityInput(BaseModel):
    lump_sum: Decimal
    rate_of_return: Decimal
    payment_periods: int = Field(..., ge=1)
    payment_frequency_per_year: int = Field(12, ge=1)

    @field_validator("rate_of_return", mode="before")
    def _to_decimal_rate(cls, v):
        return Decimal(str(v))

class AnnuityOutput(BaseModel):
    periodic_payment: Decimal
    annuity_factor: Decimal
