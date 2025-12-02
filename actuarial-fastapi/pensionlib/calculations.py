from decimal import Decimal
from .money import Money
from .models import (
    DCProjectionInput,
    DCProjectionOutput,
    YearBalance,
    DBAccrualInput,
    DBAccrualOutput,
    AnnuityInput,
    AnnuityOutput,
)
from typing import List


def project_dc_account(inp: DCProjectionInput) -> DCProjectionOutput:
    balance = Money(inp.current_balance)
    salary = Money(inp.annual_salary)
    rate = Decimal(inp.rate_of_return)
    salary_growth = Decimal(inp.salary_growth)
    contrib_rate = Decimal(inp.contribution_rate)
    years = int(inp.years)

    annual_balances: List[YearBalance] = []

    for y in range(1, years + 1):
        contribution = Money(salary.value * contrib_rate)
        balance = balance + contribution
        balance = Money(
            (balance.value * (Decimal(1) + rate)).quantize(Money("0.01").value)
        )
        annual_balances.append(
            YearBalance(
                year=y,
                salary=salary.quantize(),
                contribution=contribution.quantize(),
                balance=balance.quantize(),
            )
        )
        salary = Money(
            (salary.value * (Decimal(1) + salary_growth)).quantize(Money("0.01").value)
        )

    return DCProjectionOutput(
        initial_balance=Money(inp.current_balance).quantize(),
        annual_balances=annual_balances,
        final_balance=balance.quantize(),
    )


def project_db_accrual(inp: DBAccrualInput) -> DBAccrualOutput:
    final_salary = Decimal(inp.final_salary)
    accrual_rate = Decimal(inp.accrual_rate)
    years = int(inp.years_of_service)

    annual_accrual = (final_salary * accrual_rate).quantize(Money("0.01").value)
    total_pension = (annual_accrual * years).quantize(Money("0.01").value)

    return DBAccrualOutput(annual_accrual=annual_accrual, total_pension=total_pension)


def annuity_conversion(inp: AnnuityInput) -> AnnuityOutput:
    lump = Decimal(inp.lump_sum)
    annual_r = Decimal(inp.rate_of_return)
    freq = int(inp.payment_frequency_per_year)
    n = int(inp.payment_periods)

    r = annual_r / Decimal(freq)
    if r == 0:
        annuity_factor = Decimal(n)
        payment = (lump / annuity_factor).quantize(Money("0.01").value)
    else:
        denom = 1 - (Decimal(1) + r) ** (Decimal(-n))
        annuity_factor = (r / denom).quantize(Money("0.0000001").value)
        payment = (lump * annuity_factor).quantize(Money("0.01").value)

    return AnnuityOutput(periodic_payment=payment, annuity_factor=annuity_factor)


def commutation(annuity_payment: Decimal, commutation_pct: Decimal) -> Decimal:
    ann = Decimal(annuity_payment)
    pct = Decimal(commutation_pct)
    if pct <= 0:
        return Decimal("0.00")
    r = Decimal("0.05")
    lump = (ann * pct) / r
    return lump.quantize(Money("0.01").value)


def apply_withdrawal(balance: Decimal, withdrawal_amt: Decimal) -> Decimal:
    bal = Decimal(balance)
    w = Decimal(withdrawal_amt)
    new = bal - w
    if new < 0:
        new = Decimal("0.00")
    return new.quantize(Money("0.01").value)


def early_retirement_adjustment(
    annual_pension: Decimal, years_early: int, pct_per_year: Decimal = Decimal("0.05")
) -> Decimal:
    base = Decimal(annual_pension)
    factor = (Decimal(1) - pct_per_year) ** Decimal(years_early)
    adj = (base * factor).quantize(Money("0.01").value)
    return adj


def late_retirement_adjustment(
    annual_pension: Decimal, years_late: int, pct_per_year: Decimal = Decimal("0.02")
) -> Decimal:
    base = Decimal(annual_pension)
    factor = (Decimal(1) + pct_per_year) ** Decimal(years_late)
    adj = (base * factor).quantize(Money("0.01").value)
    return adj
