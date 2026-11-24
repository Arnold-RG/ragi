"""Money helpers. RAGI is NOT the book of record (OMH is); these only format
draft amounts consistently with the ecosystem wire rule:
{"amount": "123.45", "currency": "PLN"} — decimal string, ISO 4217, RWF has 0 minor units."""
from decimal import ROUND_HALF_EVEN, Decimal, InvalidOperation

CURRENCIES = {"PLN": 2, "RWF": 0, "EUR": 2, "USD": 2}


class MoneyError(ValueError):
    """Bad money input — mapped to HTTP 422 in app.main."""


def parse_strict(amount: Decimal | str | int, currency: str) -> Decimal:
    """Exact input parser: rejects more decimals than the currency allows (RWF "10.50" is an error, not 10)."""
    if currency not in CURRENCIES:
        raise MoneyError(f"Unsupported currency {currency}")
    try:
        d = Decimal(str(amount))
    except InvalidOperation as exc:
        raise MoneyError("Invalid amount") from exc
    if not d.is_finite() or d < 0:
        raise MoneyError("Invalid amount")
    q = d.quantize(Decimal(1).scaleb(-CURRENCIES[currency]))
    if q != d:
        raise MoneyError(f"{currency} allows {CURRENCIES[currency]} decimal places")
    return q


def quantize(amount: Decimal | str | int, currency: str) -> Decimal:
    if currency not in CURRENCIES:
        raise ValueError(f"Unsupported currency {currency}")
    try:
        d = Decimal(str(amount))
    except InvalidOperation as exc:
        raise ValueError("Invalid amount") from exc
    if not d.is_finite():
        raise ValueError("Invalid amount")
    return d.quantize(Decimal(1).scaleb(-CURRENCIES[currency]), rounding=ROUND_HALF_EVEN)


def wire(amount: Decimal, currency: str) -> dict:
    return {"amount": str(quantize(amount, currency)), "currency": currency}
