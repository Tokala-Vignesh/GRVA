from fastapi import APIRouter, Depends, HTTPException, Query
from app.security.auth import verify_token
from app.schemas.api import ExportReportRequest
from app.services.reporting_service import ReportingService

router = APIRouter(prefix="/reports", tags=["Reporting"], dependencies=[Depends(verify_token)])

@router.get("")
async def get_report_data(report_type: str = "infrastructure_health"):
    return ReportingService.generate_json_report(report_type)

@router.post("/export")
async def export_report(payload: ExportReportRequest):
    fmt = payload.format.lower()
    if fmt == "pdf":
        file_path = ReportingService.export_pdf(payload.report_type)
        return {"status": "success", "format": "pdf", "file_path": file_path}
    elif fmt == "csv":
        file_path = ReportingService.export_csv(payload.report_type)
        return {"status": "success", "format": "csv", "file_path": file_path}
    elif fmt == "json":
        data = ReportingService.generate_json_report(payload.report_type)
        return {"status": "success", "format": "json", "data": data}
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported export format: {payload.format}")
