from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Optional, Union, Dict, Any

from app.core.exceptions import ValidationError


class RoundingPolicy:
    """
    Authoritative AQ COMPANIES Decimal Rounding Standards:
    - Money: 2 decimal places (0.01)
    - Exchange & Unit Rates: 4 decimal places (0.0001)
    - Net & Gross Weights: 3 decimal places (0.001 kg)
    - Percentages: 4 decimal places (0.0001 or 0.01%)
    - Strict Rounding Mode: ROUND_HALF_UP
    """
    MONEY_PRECISION = Decimal("0.01")
    RATE_PRECISION = Decimal("0.0001")
    WEIGHT_PRECISION = Decimal("0.001")
    PERCENT_PRECISION = Decimal("0.0001")
    MODE = ROUND_HALF_UP

    @classmethod
    def round_money(cls, val: Union[Decimal, float, int, str, None]) -> Decimal:
        if val is None:
            return Decimal("0.00")
        try:
            return Decimal(str(val)).quantize(cls.MONEY_PRECISION, rounding=cls.MODE)
        except (InvalidOperation, ValueError):
            return Decimal("0.00")

    @classmethod
    def round_rate(cls, val: Union[Decimal, float, int, str, None]) -> Optional[Decimal]:
        if val is None:
            return None
        try:
            return Decimal(str(val)).quantize(cls.RATE_PRECISION, rounding=cls.MODE)
        except (InvalidOperation, ValueError):
            return None

    @classmethod
    def round_weight(cls, val: Union[Decimal, float, int, str, None]) -> Decimal:
        if val is None:
            return Decimal("0.000")
        try:
            return Decimal(str(val)).quantize(cls.WEIGHT_PRECISION, rounding=cls.MODE)
        except (InvalidOperation, ValueError):
            return Decimal("0.000")

    @classmethod
    def round_percent(cls, val: Union[Decimal, float, int, str, None]) -> Decimal:
        if val is None:
            return Decimal("0.0000")
        try:
            return Decimal(str(val)).quantize(cls.PERCENT_PRECISION, rounding=cls.MODE)
        except (InvalidOperation, ValueError):
            return Decimal("0.0000")


class CurrencyService:
    """
    Centralized Multi-Currency Engine for AQ COMPANIES.
    Base currency of account: USD ($)
    Supported operational currencies: USD, AFN (Afghan Afghani), AED (UAE Dirham), INR (Indian Rupee), EUR.
    """
    BASE_CURRENCY = "USD"
    DEFAULT_RATES: Dict[str, Decimal] = {
        "USD": Decimal("1.0000"),
        "AFN": Decimal("0.0145"),  # 1 AFN ≈ $0.0145 USD
        "AED": Decimal("0.2723"),  # 1 AED ≈ $0.2723 USD (3.6725 AED/USD)
        "INR": Decimal("0.0118"),  # 1 INR ≈ $0.0118 USD
        "EUR": Decimal("1.0850"),  # 1 EUR ≈ $1.0850 USD
    }

    @classmethod
    def validate_currency_code(cls, currency: str) -> str:
        curr = (currency or cls.BASE_CURRENCY).strip().upper()
        if curr not in cls.DEFAULT_RATES:
            # Allow custom valid 3-letter currency codes
            if len(curr) != 3 or not curr.isalpha():
                raise ValidationError(f"Invalid currency code: {currency}. Must be a 3-letter ISO code.")
        return curr

    @classmethod
    def validate_fx_rate(cls, fx_rate: Union[Decimal, float, int, str, None], currency: str = "USD") -> Decimal:
        curr = cls.validate_currency_code(currency)
        if curr == cls.BASE_CURRENCY:
            return Decimal("1.0000")
        if fx_rate is None:
            return cls.DEFAULT_RATES.get(curr, Decimal("1.0000"))
        try:
            rate = Decimal(str(fx_rate))
        except (InvalidOperation, ValueError):
            raise ValidationError(f"Invalid exchange rate value: {fx_rate}")
        if rate <= Decimal("0.0000"):
            raise ValidationError(f"Exchange rate must be positive, got {fx_rate}")
        return RoundingPolicy.round_rate(rate) or Decimal("1.0000")

    @classmethod
    def convert_to_base(
        cls,
        amount: Union[Decimal, float, int, str],
        currency: str = "USD",
        fx_rate: Optional[Union[Decimal, float, int, str]] = None,
    ) -> Decimal:
        """
        Converts non-base amount into USD base equivalent:
        Amount * FX Rate (where FX Rate is USD per 1 unit of foreign currency).
        """
        curr = cls.validate_currency_code(currency)
        amt = RoundingPolicy.round_money(amount)
        if curr == cls.BASE_CURRENCY:
            return amt
        rate = cls.validate_fx_rate(fx_rate, currency=curr)
        converted = amt * rate
        return RoundingPolicy.round_money(converted)

    @classmethod
    def convert_from_base(
        cls,
        base_amount_usd: Union[Decimal, float, int, str],
        target_currency: str,
        fx_rate: Optional[Union[Decimal, float, int, str]] = None,
    ) -> Decimal:
        """
        Converts USD base amount into target currency amount:
        USD Amount / FX Rate.
        """
        curr = cls.validate_currency_code(target_currency)
        usd_amt = RoundingPolicy.round_money(base_amount_usd)
        if curr == cls.BASE_CURRENCY:
            return usd_amt
        rate = cls.validate_fx_rate(fx_rate, currency=curr)
        if rate == 0:
            raise ValidationError("Cannot convert with zero exchange rate.")
        converted = usd_amt / rate
        return RoundingPolicy.round_money(converted)

    @classmethod
    def build_currency_payload(
        cls,
        amount_original: Union[Decimal, float, int, str],
        currency: str = "USD",
        fx_rate: Optional[Union[Decimal, float, int, str]] = None,
    ) -> Dict[str, Any]:
        """
        Generates canonical multi-currency accounting tuple preserving original and base amounts:
        - original_currency
        - original_amount
        - fx_rate
        - base_currency (USD)
        - base_amount_usd
        """
        curr = cls.validate_currency_code(currency)
        orig_amt = RoundingPolicy.round_money(amount_original)
        rate = cls.validate_fx_rate(fx_rate, currency=curr)
        base_amt = cls.convert_to_base(orig_amt, curr, rate)
        return {
            "original_currency": curr,
            "original_amount": orig_amt,
            "fx_rate": rate,
            "base_currency": cls.BASE_CURRENCY,
            "base_amount_usd": base_amt,
        }
