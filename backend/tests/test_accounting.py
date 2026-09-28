from decimal import Decimal
try:
    from app.accounting import (
        calculate_shipment_metrics,
        round_money,
        round_rate,
        round_weight,
    )
except ImportError:
    from backend.app.accounting import (
        calculate_shipment_metrics,
        round_money,
        round_rate,
        round_weight,
    )


def test_basic_shipment_metrics():
    """Test standard shipment calculation formulas from prompt."""
    res = calculate_shipment_metrics(
        net_weight_kg=Decimal("20000.000"),
        cartons=2000,
        selling_rate=Decimal("3.5000"),
        purchase_rate=Decimal("2.2000"),
        transport_freight=Decimal("6000.00"),
        afghanistan_truck_cost=Decimal("1500.00"),
        driver_rent=Decimal("400.00"),
        customs_cost=Decimal("1000.00"),
        documentation_cost=Decimal("300.00"),
        border_cost=Decimal("500.00"),
        bank_charges=Decimal("120.00"),
        commission=Decimal("400.00"),
        other_expenses=Decimal("150.00"),
        customer_amount_received=Decimal("30000.00"),
        transport_paid=Decimal("5000.00"),
        supplier_amount_paid=Decimal("20000.00"),
    )

    # Sales Value = 20,000 * 3.50 = 70,000.00
    assert res["invoice_value"] == Decimal("70000.00")

    # Purchase Cost = 20,000 * 2.20 = 44,000.00
    assert res["purchase_cost"] == Decimal("44000.00")

    # Transport Charge = 6000 + 1500 + 400 + 500 = 8400.00
    assert res["transport_charge"] == Decimal("8400.00")

    # Total Cost = 44000 + 8400 + 1000 + 300 + 120 + 400 + 150 = 54370.00
    assert res["total_cost"] == Decimal("54370.00")

    # Net Profit = 70,000 - 54,370 = 15,630.00
    assert res["net_profit"] == Decimal("15630.00")

    # Profit per KG = 15630 / 20000 = 0.7815
    assert res["profit_per_kg"] == Decimal("0.7815")

    # Profit per Carton = 15630 / 2000 = 7.82
    assert res["profit_per_carton"] == Decimal("7.82")

    # Profit Margin % = (15630 / 70000) * 100 = 22.33%
    assert res["profit_margin_pct"] == Decimal("22.33")

    # Customer Balance = 70,000 - 30,000 = 40,000.00
    assert res["customer_balance"] == Decimal("40000.00")

    # Transport Balance = 8,400 - 5,000 = 3,400.00
    assert res["transport_balance"] == Decimal("3400.00")

    # Supplier Balance = 44,000 - 20,000 = 24,000.00
    assert res["supplier_balance"] == Decimal("24000.00")


def test_transport_credit_balance():
    """
    Test prompt rule:
    Transport Charges: $743,650
    Credits / Payments: $1,034,810
    Balance: $743,650 - $1,034,810 = -$291,160
    Credit with transport company: $291,160
    """
    res = calculate_shipment_metrics(
        net_weight_kg=Decimal("10000.000"),
        cartons=1000,
        selling_rate=Decimal("100.0000"),
        purchase_rate=Decimal("50.0000"),
        transport_freight=Decimal("743650.00"),
        afghanistan_truck_cost=Decimal("0.00"),
        driver_rent=Decimal("0.00"),
        customs_cost=Decimal("0.00"),
        documentation_cost=Decimal("0.00"),
        border_cost=Decimal("0.00"),
        bank_charges=Decimal("0.00"),
        commission=Decimal("0.00"),
        other_expenses=Decimal("0.00"),
        customer_amount_received=Decimal("0.00"),
        transport_paid=Decimal("1034810.00"),
        supplier_amount_paid=Decimal("0.00"),
    )
    assert res["transport_charge"] == Decimal("743650.00")
    assert res["transport_paid"] == Decimal("1034810.00")
    assert res["transport_balance"] == Decimal("-291160.00")


def test_multi_product_container_rollup():
    """
    Test prompt rule:
    Dry Figs: 17,520 KG @ $7.38 = $129,297.60
    Black Raisins: 5,920 KG @ $3.10 = $18,352.00
    Total invoice: $147,649.60
    """
    items = [
        {
            "net_weight_kg": Decimal("17520.000"),
            "cartons": 1752,
            "selling_rate": Decimal("7.3800"),
            "purchase_rate": Decimal("5.2000"),
        },
        {
            "net_weight_kg": Decimal("5920.000"),
            "cartons": 592,
            "selling_rate": Decimal("3.1000"),
            "purchase_rate": Decimal("2.1000"),
        },
    ]

    res = calculate_shipment_metrics(
        net_weight_kg=Decimal("0.000"),
        cartons=0,
        selling_rate=Decimal("0.0000"),
        purchase_rate=Decimal("0.0000"),
        transport_freight=Decimal("5000.00"),
        afghanistan_truck_cost=Decimal("0.00"),
        driver_rent=Decimal("0.00"),
        customs_cost=Decimal("0.00"),
        documentation_cost=Decimal("0.00"),
        border_cost=Decimal("0.00"),
        bank_charges=Decimal("0.00"),
        commission=Decimal("0.00"),
        other_expenses=Decimal("0.00"),
        customer_amount_received=Decimal("0.00"),
        transport_paid=Decimal("0.00"),
        supplier_amount_paid=Decimal("0.00"),
        items=items,
    )

    # 17520 * 7.38 = 129297.60, 5920 * 3.10 = 18352.00 => sum 147649.60
    assert res["invoice_value"] == Decimal("147649.60")
    # 17520 * 5.20 = 91104.00, 5920 * 2.10 = 12432.00 => sum 103536.00
    assert res["purchase_cost"] == Decimal("103536.00")
    assert res["net_weight_kg"] == Decimal("23440.000")
    assert res["cartons"] == 2344
