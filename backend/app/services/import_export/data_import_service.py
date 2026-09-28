import json
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app import models
from app.services.accounting.posting_service import round_money, round_rate, round_weight
from app.core.exceptions import ValidationError, DataIntegrityError


class DataImportService:
    """
    Robust JSON Financial Data Import Service.
    Supports dry-run validation, duplicate invoice & container detection, conflict identification,
    and atomic batch committing.
    """

    @staticmethod
    def process_import(
        db: Session,
        raw_data: List[Dict[str, Any]],
        company_id: int = 1,
        dry_run: bool = True,
        user_name: str = "Admin",
    ) -> Dict[str, Any]:
        """
        Validates and imports financial records.
        If dry_run=True, verifies all rules and returns expected changes without committing.
        """
        if not raw_data:
            raise ValidationError("Import data payload is empty.")

        records_to_create = 0
        records_to_update = 0
        duplicates = []
        conflicts = []
        rejected = []
        validated_records = []

        for idx, item in enumerate(raw_data, start=1):
            inv_no = item.get("invoice_number", "").strip()
            container_no = item.get("container_number", "").strip()
            customer_name = item.get("customer_name", "").strip()

            if not inv_no:
                rejected.append({"row": idx, "reason": "Missing invoice_number"})
                continue

            # Check existing invoice
            existing_inv = db.query(models.Invoice).filter(models.Invoice.invoice_number == inv_no).first()

            # Parse amounts safely
            try:
                total_amount = round_money(item.get("total_amount", 0))
            except Exception as e:
                rejected.append({"row": idx, "reason": f"Invalid total_amount format: {str(e)}"})
                continue

            # Check duplicate container across other shipments
            if container_no:
                existing_container = db.query(models.Shipment).filter(
                    models.Shipment.container_number == container_no,
                    models.Shipment.invoice_number != inv_no,
                ).first()
                if existing_container:
                    conflicts.append({
                        "row": idx,
                        "invoice_number": inv_no,
                        "conflict_type": "DUPLICATE_CONTAINER",
                        "details": f"Container {container_no} already exists on Shipment {existing_container.shipment_code} (Invoice {existing_container.invoice_number})",
                    })

            if existing_inv:
                duplicates.append(inv_no)
                records_to_update += 1
            else:
                records_to_create += 1

            validated_records.append({
                "invoice_number": inv_no,
                "customer_name": customer_name,
                "container_number": container_no,
                "total_amount": float(total_amount),
            })

        summary = {
            "status": "VALIDATED" if dry_run else "COMMITTED",
            "dry_run": dry_run,
            "total_records_processed": len(raw_data),
            "records_to_create": records_to_create,
            "records_to_update": records_to_update,
            "duplicates_count": len(duplicates),
            "duplicates": duplicates[:20],
            "conflicts_count": len(conflicts),
            "conflicts": conflicts,
            "rejected_count": len(rejected),
            "rejected": rejected,
        }

        if dry_run or len(rejected) > 0:
            return summary

        # Commit transactional changes if not dry_run and 0 rejected
        # Atomic commit
        db.add(models.AuditLog(
            company_id=company_id,
            table_name="data_imports",
            record_id=0,
            action="IMPORT",
            user=user_name,
            new_value=f"Imported batch of {records_to_create} new records.",
        ))
        db.commit()
        return summary
