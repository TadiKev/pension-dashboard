from decimal import Decimal, getcontext, ROUND_HALF_UP

getcontext().rounding = ROUND_HALF_UP
QUANT = Decimal("0.01")


def quantize_money(d: Decimal) -> Decimal:
    return d.quantize(QUANT)
