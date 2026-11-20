import os
import json
import csv
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pathlib import Path
import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from app.core.config import settings
from app.database.session import SyncSessionLocal
from app.models.entities import (
    CloudConnection,
    CloudResource,
    Incident,
    Alert,
    SecurityEvent,
)

class ReportingService:
    """Generates Infrastructure Health, Incident, and Anomaly Reports in PDF, CSV, and JSON."""

    @staticmethod
    def generate_json_report(report_type: str = "infrastructure_health") -> Dict[str, Any]:
        with SyncSessionLocal() as session:
            now_str = datetime.now(timezone.utc).isoformat()
            if report_type == "infrastructure_health":
                conns = session.query(CloudConnection).all()
                resources = session.query(CloudResource).all()
                data = {
                    "report_type": report_type,
                    "generated_at": now_str,
                    "cloud_accounts": [
                        {"name": c.name, "provider": c.provider, "region": c.region, "status": c.status}
                        for c in conns
                    ],
                    "resources": [
                        {
                            "id": r.resource_id,
                            "name": r.resource_name,
                            "provider": r.provider,
                            "status": r.status,
                            "type": r.instance_type,
                            "ip": r.ip_address,
                        }
                        for r in resources
                    ],
                }
            elif report_type == "incidents":
                incidents = session.query(Incident).all()
                data = {
                    "report_type": report_type,
                    "generated_at": now_str,
                    "incidents": [
                        {
                            "incident_number": inc.incident_number,
                            "title": inc.title,
                            "provider": inc.provider,
                            "severity": inc.severity,
                            "status": inc.status,
                            "created_at": inc.created_at.isoformat() if inc.created_at else None,
                        }
                        for inc in incidents
                    ],
                }
            else:
                events = session.query(SecurityEvent).all()
                data = {
                    "report_type": report_type,
                    "generated_at": now_str,
                    "security_events": [
                        {
                            "event_name": e.event_name,
                            "provider": e.provider,
                            "severity": e.severity,
                            "source_ip": e.source_ip,
                            "occurred_at": e.occurred_at.isoformat() if e.occurred_at else None,
                        }
                        for e in events
                    ],
                }
            return data

    @staticmethod
    def export_csv(report_type: str, output_path: Optional[Path] = None) -> str:
        data = ReportingService.generate_json_report(report_type)
        if output_path is None:
            output_path = settings.REPORTS_DIR / f"{report_type}_{int(datetime.now().timestamp())}.csv"

        if report_type == "infrastructure_health":
            rows = data.get("resources", [])
        elif report_type == "incidents":
            rows = data.get("incidents", [])
        else:
            rows = data.get("security_events", [])

        if rows:
            df = pd.DataFrame(rows)
            df.to_csv(output_path, index=False)
        else:
            output_path.write_text("No records available\n")

        return str(output_path)

    @staticmethod
    def export_pdf(report_type: str, output_path: Optional[Path] = None) -> str:
        data = ReportingService.generate_json_report(report_type)
        if output_path is None:
            output_path = settings.REPORTS_DIR / f"{report_type}_{int(datetime.now().timestamp())}.pdf"

        c = canvas.Canvas(str(output_path), pagesize=letter)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, 750, f"CloudSentinel AI — {report_type.replace('_', ' ').title()} Report")
        
        c.setFont("Helvetica", 10)
        c.drawString(50, 735, f"Generated: {data['generated_at']} (Local-First)")
        c.line(50, 725, 550, 725)

        y = 700
        c.setFont("Helvetica-Bold", 12)
        if report_type == "infrastructure_health":
            c.drawString(50, y, f"Total Resources: {len(data.get('resources', []))}")
            y -= 25
            c.setFont("Helvetica", 9)
            for r in data.get("resources", [])[:20]: # show first 20
                c.drawString(50, y, f"[{r['provider'].upper()}] {r['name']} ({r['id']}) - Status: {r['status']} - Type: {r['type']}")
                y -= 18
                if y < 50:
                    c.showPage()
                    y = 750
        elif report_type == "incidents":
            c.drawString(50, y, f"Total Incidents: {len(data.get('incidents', []))}")
            y -= 25
            c.setFont("Helvetica", 9)
            for inc in data.get("incidents", [])[:20]:
                c.drawString(50, y, f"[{inc['severity'].upper()}] {inc['incident_number']}: {inc['title']} ({inc['status']})")
                y -= 18
                if y < 50:
                    c.showPage()
                    y = 750

        c.save()
        return str(output_path)
