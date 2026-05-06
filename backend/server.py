from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import os
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from database import db, client
from ws_manager import manager
from auth import get_current_user

# Routes
from routes.auth_routes import router as auth_router
from routes.dashboard_routes import router as dashboard_router
from routes.conversas_routes import router as conversas_router
from routes.kanban_routes import router as kanban_router
from routes.assistente_routes import router as assistente_router
from routes.alertas_routes import router as alertas_router
from routes.config_routes import router as config_router
from routes.admin_routes import router as admin_router
from routes.webhook_routes import router as webhook_router
from routes.integrations_routes import router as integrations_router
from routes.billing_routes import router as billing_router

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="ClinicaPanel API v2.0")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(conversas_router, prefix="/conversas", tags=["conversas"])
api_router.include_router(kanban_router, prefix="/kanban", tags=["kanban"])
api_router.include_router(assistente_router, prefix="/assistente", tags=["assistente"])
api_router.include_router(alertas_router, prefix="/escalacoes", tags=["escalacoes"])
api_router.include_router(config_router, prefix="/config", tags=["config"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(webhook_router, prefix="/webhook", tags=["webhook"])
api_router.include_router(integrations_router, prefix="/integrations", tags=["integrations"])
api_router.include_router(billing_router, prefix="/billing", tags=["billing"])


@api_router.websocket("/ws/{tenant_id}")
async def websocket_endpoint(websocket: WebSocket, tenant_id: str):
    await manager.connect(websocket, tenant_id)
    logger.info(f"WS connected: tenant={tenant_id}")
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, tenant_id)
        logger.info(f"WS disconnected: tenant={tenant_id}")


@api_router.get("/")
async def root():
    return {"message": "ClinicaPanel API v2.0", "status": "online"}


app.include_router(api_router)


@app.on_event("startup")
async def startup():
    logger.info("ClinicaPanel API starting...")
    # Create indexes
    await db.cp_kanban_cards.create_index([("tenant_id", 1), ("telefone", 1)], unique=True)
    await db.cp_kanban_cards.create_index([("tenant_id", 1), ("status", 1)])
    await db.cp_operadores.create_index([("tenant_id", 1), ("email", 1)], unique=True)
    await db.cp_super_admins.create_index([("email", 1)], unique=True)
    await db.cp_tenants.create_index([("slug", 1)], unique=True)
    await db.cp_escalacoes.create_index([("tenant_id", 1), ("recebido_em", -1)])
    await db.cp_audit_log.create_index([("tenant_id", 1), ("timestamp", -1)])
    await db.cp_push_subscriptions.create_index([("endpoint", 1)], unique=True)
    await db.cp_push_subscriptions.create_index([("tenant_id", 1), ("ativo", 1)])
    await db.cp_google_tokens.create_index([("tenant_id", 1)], unique=True)
    await db.cp_oauth_states.create_index([("state", 1)], unique=True)
    await db.payment_transactions.create_index([("session_id", 1)], unique=True)
    await db.payment_transactions.create_index([("tenant_id", 1), ("criado_em", -1)])
    logger.info("Indexes created")


@app.on_event("shutdown")
async def shutdown():
    client.close()
