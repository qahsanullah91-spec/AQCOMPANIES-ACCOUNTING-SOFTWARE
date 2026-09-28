from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.api.v1.accounting import router as accounting_router
from app.api.v1.receivables import router as receivables_router
from app.api.v1.payables import router as payables_router
from app.api.v1.transport import router as transport_router
from app.api.v1.banking import router as banking_router
from app.api.v1.treasury import router as treasury_router
from app.api.v1.reports import router as reports_router
from app.api.v1.backup import router as backup_router
from app.api.v1.search import router as search_router
from app.api.v1.security import router as security_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.system import router as system_router
from app.api.v1.golive import router as golive_router
from app.api.v1.stabilization import router as stabilization_router

api_v1_router = APIRouter(prefix="/v1")

# Mount sub-routers under /v1
api_v1_router.include_router(health_router)
api_v1_router.include_router(accounting_router)
api_v1_router.include_router(receivables_router)
api_v1_router.include_router(payables_router)
api_v1_router.include_router(transport_router)
api_v1_router.include_router(banking_router)
api_v1_router.include_router(treasury_router)
api_v1_router.include_router(reports_router)
api_v1_router.include_router(backup_router)
api_v1_router.include_router(search_router)
api_v1_router.include_router(security_router)
api_v1_router.include_router(jobs_router)
api_v1_router.include_router(system_router)
api_v1_router.include_router(golive_router)
api_v1_router.include_router(stabilization_router)
