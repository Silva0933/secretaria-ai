"""Integrations: Google Calendar OAuth + Web Push subscription."""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List
import os
import secrets
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

from database import db, doc, docs
from auth import require_operador, require_admin, decode_token
from services import google_calendar as gc
from services import push as ps
from bson import ObjectId
from jose import JWTError

router = APIRouter()


# ============== Web Push ==============

class PushSubscriptionBody(BaseModel):
    endpoint: str
    keys: dict


@router.get("/push/public-key")
async def get_push_public_key():
    return {"publicKey": os.environ.get("VAPID_PUBLIC_KEY", ""), "configured": ps.is_configured()}


@router.post("/push/subscribe")
async def push_subscribe(body: PushSubscriptionBody, user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]
    operador_id = user["sub"]
    now = datetime.now(timezone.utc).isoformat()

    # Upsert by endpoint
    await db.cp_push_subscriptions.update_one(
        {"endpoint": body.endpoint},
        {"$set": {
            "tenant_id": tenant_id,
            "operador_id": operador_id,
            "endpoint": body.endpoint,
            "keys": body.keys,
            "ativo": True,
            "atualizado_em": now,
        }, "$setOnInsert": {"criado_em": now}},
        upsert=True,
    )
    return {"ok": True}


@router.post("/push/unsubscribe")
async def push_unsubscribe(body: PushSubscriptionBody, user: dict = Depends(require_operador)):
    await db.cp_push_subscriptions.update_one(
        {"endpoint": body.endpoint, "tenant_id": user["tenant_id"]},
        {"$set": {"ativo": False}},
    )
    return {"ok": True}


@router.post("/push/test")
async def push_test(user: dict = Depends(require_admin)):
    sent = await ps.broadcast_to_tenant(
        user["tenant_id"],
        title="ClinicaPanel — Teste",
        body="Notificações push estão funcionando!",
        url="/dashboard",
    )
    return {"ok": True, "sent": sent}


# ============== Google Calendar OAuth ==============

class GoogleAuthURLResponse(BaseModel):
    url: str


def _redirect_uri(request: Request) -> str:
    base = (os.environ.get("BACKEND_PUBLIC_URL") or str(request.base_url)).rstrip("/")
    return f"{base}/api/integrations/google/callback"


@router.get("/google/status")
async def google_status(user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]
    rec = await db.cp_google_tokens.find_one({"tenant_id": tenant_id})
    return {
        "configured": gc.is_configured(),
        "connected": bool(rec and rec.get("refresh_token")),
        "email": rec.get("email") if rec else None,
        "connected_at": rec.get("connected_at") if rec else None,
    }


@router.get("/google/authorize")
async def google_authorize(request: Request, user: dict = Depends(require_admin)):
    if not gc.is_configured():
        raise HTTPException(status_code=503, detail="Google OAuth não configurado")

    # state = signed JWT-ish random token tied to tenant+operador
    state = secrets.token_urlsafe(24)
    await db.cp_oauth_states.insert_one({
        "state": state,
        "tenant_id": user["tenant_id"],
        "operador_id": user["sub"],
        "criado_em": datetime.now(timezone.utc).isoformat(),
        "usado": False,
    })
    redirect_uri = _redirect_uri(request)
    url = gc.build_auth_url(redirect_uri, state)
    return {"url": url, "redirect_uri": redirect_uri}


@router.get("/google/callback")
async def google_callback(request: Request):
    """OAuth2 redirect target (no auth header — uses state)."""
    qp = request.query_params
    code = qp.get("code")
    state = qp.get("state")
    error = qp.get("error")

    frontend_url = os.environ.get("FRONTEND_URL", "")

    def _redirect(success: bool, msg: str = ""):
        # redirect to frontend Configuracoes page with status
        params = urlencode({"google_status": "ok" if success else "error", "msg": msg[:200]})
        target = f"{frontend_url}/configuracoes?{params}" if frontend_url else f"/configuracoes?{params}"
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=target, status_code=302)

    if error:
        return _redirect(False, f"Google retornou erro: {error}")
    if not code or not state:
        return _redirect(False, "Parâmetros ausentes")

    state_rec = await db.cp_oauth_states.find_one({"state": state, "usado": False})
    if not state_rec:
        return _redirect(False, "State inválido ou expirado")

    # Verify not older than 15 minutes
    try:
        criado = datetime.fromisoformat(state_rec.get("criado_em").replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - criado > timedelta(minutes=15):
            return _redirect(False, "State expirado (>15min)")
    except Exception:
        pass

    # Mark used
    await db.cp_oauth_states.update_one({"_id": state_rec["_id"]}, {"$set": {"usado": True}})

    try:
        redirect_uri = _redirect_uri(request)
        token_data = gc.exchange_code(redirect_uri, code)
    except Exception as e:
        return _redirect(False, f"Falha ao trocar código: {e}")

    # Get user email via userinfo
    email = None
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        creds = Credentials(
            token=token_data["access_token"],
            refresh_token=token_data.get("refresh_token"),
            token_uri=token_data.get("token_uri"),
            client_id=os.environ.get("GOOGLE_CLIENT_ID"),
            client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
            scopes=token_data.get("scopes"),
        )
        oauth_service = build("oauth2", "v2", credentials=creds, cache_discovery=False)
        info = oauth_service.userinfo().get().execute()
        email = info.get("email")
    except Exception:
        pass

    now = datetime.now(timezone.utc).isoformat()
    await db.cp_google_tokens.update_one(
        {"tenant_id": state_rec["tenant_id"]},
        {"$set": {
            "tenant_id": state_rec["tenant_id"],
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "token_uri": token_data.get("token_uri"),
            "scopes": token_data.get("scopes"),
            "expiry": token_data.get("expiry"),
            "email": email,
            "connected_at": now,
            "atualizado_em": now,
        }},
        upsert=True,
    )

    return _redirect(True, "Google Calendar conectado")


@router.delete("/google/disconnect")
async def google_disconnect(user: dict = Depends(require_admin)):
    await db.cp_google_tokens.delete_one({"tenant_id": user["tenant_id"]})
    return {"ok": True}


@router.get("/google/events")
async def google_events(user: dict = Depends(require_operador), days: int = 7, calendar_id: str = "primary"):
    now = datetime.now(timezone.utc)
    res = await gc.list_events(user["tenant_id"], calendar_id, now, now + timedelta(days=days))
    if not res["ok"]:
        raise HTTPException(status_code=400, detail=res.get("error", "Erro ao listar eventos"))
    return res


class CreateEventBody(BaseModel):
    calendar_id: str = "primary"
    summary: str
    description: Optional[str] = ""
    start_iso: str
    end_iso: str
    attendees: Optional[List[str]] = None
    time_zone: Optional[str] = "America/Sao_Paulo"


@router.post("/google/events")
async def google_create_event(body: CreateEventBody, user: dict = Depends(require_operador)):
    res = await gc.create_event(
        user["tenant_id"],
        body.calendar_id,
        body.summary,
        body.start_iso,
        body.end_iso,
        body.description or "",
        body.attendees,
        body.time_zone or "America/Sao_Paulo",
    )
    if not res["ok"]:
        raise HTTPException(status_code=400, detail=res.get("error", "Erro ao criar evento"))
    return res
