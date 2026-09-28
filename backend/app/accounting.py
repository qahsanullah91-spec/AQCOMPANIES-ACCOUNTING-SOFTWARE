from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any


def round_money(val: Any) -> Decimal:
    """Round monetary amount to 2 decimal places using standard ROUND_HALF_UP."""
    if val is None:
        return Decimal("0.00")
    d = Decimal(str(val)) if not isinstance(val, Decimal) else val
    return d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def round_rate(val: Any) -> Decimal:
    """Round rate to 4 decimal places."""
    if val is None:
        return Decimal("0.0000")
    d = Decimal(str(val)) if not isinstance(val, Decimal) else val
    return d.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def round_weight(val: Any) -> Decimal:
    """Round weight to 3 decimal places."""
    if val is None:
        return Decimal("0.000")
    d = Decimal(str(val)) if not isinstance(val, Decimal) else val
    return d.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


def calculate_shipment_metrics(
    net_weight_kg: Decimal,
    cartons: int,
    selling_rate: Decimal,
    purchase_rate: Decimal,
    transport_freight: Decimal,
    afghanistan_truck_cost: Decimal,
    driver_rent: Decimal,
    customs_cost: Decimal,
    documentation_cost: Decimal,
    border_cost: Decimal,
    bank_charges: Decimal,
    commission: Decimal,
    other_expenses: Decimal,
    customer_amount_received: Decimal,
    transport_paid: Decimal,
    supplier_amount_paid: Decimal,
    items: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Decimal]:
    """
    Computes all standard shipment accounting fields adhering strictly to dry-fruit business rules:
    - Multi-product support: if items are provided, roll up individual item amounts exactly
    - Weighted averages are computed ONLY for summary fields; never replace individual lines
    - Net Profit = Sales Value - Total Cost
    - Profit per KG = Net Profit / Net Weight
    - Profit per Carton = Net Profit / Cartons
    - Profit Margin % = (Net Profit / Sales Value) * 100
    - Transport Balance = Transport Charge - Transport Paid (if negative, credit in our favor)
    - Customer Balance = Invoice Value - Customer Amount Received
    - Supplier Balance = Purchase Cost - Supplier Amount Paid
    """
    net_weight = round_weight(net_weight_kg)
    cartons_count = int(cartons or 0)

    # Calculate Sales Value and Purchase Cost
    calc_sales_value = None
    calc_rate_per_kg = None
    calc_purchase_cost = None
    calc_purchase_rate = None

    if items and len(items) > 0:
        total_sales_value = Decimal("0.00")
        total_purchase_cost = Decimal("0.00")
        has_valid_sale = False
        has_valid_purchase = False
        calc_net_weight = Decimal("0.000")
        calc_cartons = 0

        for it in items:
            it_net = round_weight(it.get("net_weight_kg", 0))
            calc_net_weight += it_net
            calc_cartons += int(it.get("cartons", 0) or 0)

            it_s_rate = it.get("selling_rate")
            if it_s_rate is not None:
                has_valid_sale = True
                s_rate_d = round_rate(it_s_rate)
                total_sales_value += round_money(it_net * s_rate_d)

            it_p_rate = it.get("purchase_rate")
            if it_p_rate is not None:
                has_valid_purchase = True
                p_rate_d = round_rate(it_p_rate)
                total_purchase_cost += round_money(it_net * p_rate_d)

        if has_valid_sale:
            calc_sales_value = round_money(total_sales_value)
            calc_rate_per_kg = round_rate(calc_sales_value / calc_net_weight) if calc_net_weight > 0 else Decimal("0.0000")
        
        if has_valid_purchase:
            calc_purchase_cost = round_money(total_purchase_cost)
            calc_purchase_rate = round_rate(calc_purchase_cost / calc_net_weight) if calc_net_weight > 0 else Decimal("0.0000")

        if calc_net_weight > Decimal("0.000"):
            net_weight = calc_net_weight
        if calc_cartons > 0:
            cartons_count = calc_cartons
    else:
        if selling_rate is not None:
            calc_rate_per_kg = round_rate(selling_rate)
            calc_sales_value = round_money(net_weight * calc_rate_per_kg)
        
        if purchase_rate is not None:
            calc_purchase_rate = round_rate(purchase_rate)
            calc_purchase_cost = round_money(net_weight * calc_purchase_rate)

    t_freight = round_money(transport_freight)
    afg_truck = round_money(afghanistan_truck_cost)
    d_rent = round_money(driver_rent)
    c_cost = round_money(customs_cost)
    doc_cost = round_money(documentation_cost)
    b_cost = round_money(border_cost)
    b_charges = round_money(bank_charges)
    comm = round_money(commission)
    o_expenses = round_money(other_expenses)

    # Transport Charge total for this shipment: Freight + Afg Truck + Driver Rent + Border
    transport_charge = round_money(t_freight + afg_truck + d_rent + b_cost)

    # Total Operational Expenses (excluding purchase cost)
    transport_and_ops_cost = round_money(
        transport_charge + c_cost + doc_cost + b_charges + comm + o_expenses
    )

    if calc_purchase_cost is not None:
        total_cost = round_money(calc_purchase_cost + transport_and_ops_cost)
    else:
        total_cost = transport_and_ops_cost  # Known operational expenses so far

    # Net Profit is strictly NULL / Unknown if purchase cost or sales value is missing
    if calc_purchase_cost is not None and calc_sales_value is not None:
        net_profit = round_money(calc_sales_value - total_cost)
        profit_per_kg = round_rate(net_profit / net_weight) if net_weight > Decimal("0.000") else Decimal("0.0000")
        profit_per_carton = round_money(net_profit / Decimal(cartons_count)) if cartons_count > 0 else Decimal("0.00")
        if calc_sales_value > Decimal("0.00"):
            profit_margin_pct = round_money((net_profit / calc_sales_value) * Decimal("100.00"))
        else:
            profit_margin_pct = Decimal("0.00")
        profit_display_status = "CALCULATED"
    else:
        net_profit = None
        profit_per_kg = None
        profit_per_carton = None
        profit_margin_pct = None
        if calc_purchase_cost is None:
            profit_display_status = "PENDING PURCHASE COST"
        else:
            profit_display_status = "PENDING SALES RATE"

    # Balances
    cust_received = round_money(customer_amount_received)
    customer_balance = round_money(calc_sales_value - cust_received) if calc_sales_value is not None else None

    trans_paid = round_money(transport_paid)
    transport_balance = round_money(transport_charge - trans_paid)

    supp_paid = round_money(supplier_amount_paid)
    supplier_balance = round_money(calc_purchase_cost - supp_paid) if calc_purchase_cost is not None else None

    return {
        "net_weight_kg": net_weight,
        "cartons": cartons_count,
        "rate_per_kg": calc_rate_per_kg,
        "invoice_value": calc_sales_value,
        "purchase_rate": calc_purchase_rate,
        "purchase_cost": calc_purchase_cost,
        "transport_charge": transport_charge,
        "total_cost": total_cost,
        "net_profit": net_profit,
        "profit_per_kg": profit_per_kg,
        "profit_per_carton": profit_per_carton,
        "profit_margin_pct": profit_margin_pct,
        "profit_display_status": profit_display_status,
        "customer_amount_received": cust_received,
        "customer_balance": customer_balance,
        "transport_paid": trans_paid,
        "transport_balance": transport_balance,
        "supplier_amount_paid": supp_paid,
        "supplier_balance": supplier_balance,
    }
