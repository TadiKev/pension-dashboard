from decimal import Decimal, getcontext, ROUND_HALF_UP, Context

# Precision & rounding policy
getcontext().prec = 28
DEFAULT_CONTEXT = Context(prec=28, rounding=ROUND_HALF_UP)
QUANT = Decimal("0.01")

class Money:
    """Small Money helper that wraps Decimal and provides consistent quantize behaviour."""
    def __init__(self, value):
        if isinstance(value, Money):
            self.value = value.value
        else:
            self.value = DEFAULT_CONTEXT.create_decimal(str(value))

    def quantize(self):
        return self.value.quantize(QUANT, rounding=DEFAULT_CONTEXT.rounding)

    def __add__(self, other):
        return Money((self.value + Money(other).value).quantize(QUANT))

    def __sub__(self, other):
        return Money((self.value - Money(other).value).quantize(QUANT))

    def __mul__(self, other):
        return Money((self.value * Money(other).value).quantize(QUANT))

    def __truediv__(self, other):
        return Money((self.value / Money(other).value).quantize(QUANT))

    def __repr__(self):
        return f"Money('{self.quantize()}')"

    def to_decimal(self):
        return self.quantize()
