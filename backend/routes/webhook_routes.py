from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from database import db, doc
from datetime import datetime, timezone
from bson import ObjectId
from ws_manager import manager
from services import push as ps
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "cp_wh_secret_2026")


async def validate_webhook(request: Request, tenant_id: str = None, instancia: str = None):
    secret = request.headers.get("x-webhook-secret", "")
    
    tenant = None
    if tenant_id:
        tenant = await db.cp_tenants.find_one({"_id": ObjectId(tenant_id)})
    elif instancia:
        tenant = await db.cp_tenants.find_one({"instancia_evolution": instancia})
        
    if not tenant:
        raise HTTPException(status_code=401, detail="Tenant não encontrado")
    
    expected = tenant.get("webhook_secret", WEBHOOK_SECRET)
    if secret != expected:
        raise HTTPException(status_code=401, detail="Webhook não autorizado")
    return tenant


@router.get("/config/{instancia}")
async def get_tenant_config(instancia: str, request: Request, telefone: Optional[str] = None):
    try:
        tenant = await validate_webhook(request, instancia=instancia)
    except Exception:
        # Allow with default secret for n8n testing
        secret = request.headers.get("x-webhook-secret", "")
        if secret != WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Não autorizado")
        tenant = await db.cp_tenants.find_one({"instancia_evolution": instancia})
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant não encontrado")

    tenant_id = str(tenant["_id"])
    configs_raw = await db.cp_tenant_config.find({"tenant_id": tenant_id}).to_list(100)
    config_map = {c["chave"]: c["valor"] for c in configs_raw}
    
    profs_raw = await db.cp_profissionais.find({"tenant_id": tenant_id, "ativo": True}).to_list(100)
    
    # Generate the professionals block for the system prompt
    prof_text = "\n".join([f"- {p['nome']} - {p.get('especialidade', '')} ({p.get('calendar_id', '')})" for p in profs_raw])
    
    # Construct base prompt config
    system_prompt = f"""Você atua em nome da {tenant.get('nome')}.
Endereço: {config_map.get('endereco', 'Endereço não informado')}
Telefone: {tenant.get('telefone_contato', '')}

## PROFISSIONAIS E ESPECIALIDADES
{prof_text}"""

    # Check human mode
    modo_humano_ativo = False
    if telefone:
        hm = await db.cp_atendimento_humano.find_one({"tenant_id": tenant_id, "telefone": telefone, "ativo": True})
        if hm:
            modo_humano_ativo = True

    return {
        "tenant_id": tenant_id,
        "nome": tenant.get("nome"),
        "webhook_secret": tenant.get("webhook_secret"),
        "url_evolution": tenant.get("url_evolution"),
        "url_n8n": tenant.get("url_n8n"),
        "telegram_chat_id": config_map.get("telegram_chat_id", ""),
        "system_prompt": system_prompt,
        "config": config_map,
        "profissionais": [{"nome": p["nome"], "calendar_id": p.get("calendar_id")} for p in profs_raw],
        "modo_humano_ativo": modo_humano_ativo
    }




@router.get("/config_by_telegram/{chat_id}")
async def get_tenant_config_by_telegram(chat_id: str, request: Request):
    secret = request.headers.get("x-webhook-secret", "")
    if secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Não autorizado")
        
    config_entry = await db.cp_tenant_config.find_one({"chave": "telegram_chat_id", "valor": chat_id})
    if not config_entry:
        raise HTTPException(status_code=404, detail="Tenant não encontrado para este chat_id")
        
    tenant_id = config_entry["tenant_id"]
    tenant = await db.cp_tenants.find_one({"_id": ObjectId(tenant_id)})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    configs_raw = await db.cp_tenant_config.find({"tenant_id": tenant_id}).to_list(100)
    config_map = {c["chave"]: c["valor"] for c in configs_raw}
    
    profs_raw = await db.cp_profissionais.find({"tenant_id": tenant_id, "ativo": True}).to_list(100)
    
    # Generate the professionals block for the system prompt
    prof_text = "\n".join([f"- {p['nome']} - {p.get('especialidade', '')} ({p.get('calendar_id', '')})" for p in profs_raw])
    
    # Construct base prompt config
    system_prompt = f"""Você atua em nome da {tenant.get('nome')}.
Endereço: {config_map.get('endereco', 'Endereço não informado')}
Telefone: {tenant.get('telefone_contato', '')}

## PROFISSIONAIS E ESPECIALIDADES
{prof_text}"""

    return {
        "tenant_id": tenant_id,
        "instancia": tenant.get("instancia_evolution"),
        "nome": tenant.get("nome"),
        "webhook_secret": tenant.get("webhook_secret"),
        "url_evolution": tenant.get("url_evolution"),
        "url_n8n": tenant.get("url_n8n"),
        "telegram_chat_id": chat_id,
        "system_prompt": system_prompt,
        "config": config_map,
        "profissionais": [{"nome": p["nome"], "calendar_id": p.get("calendar_id")} for p in profs_raw]
    }


class KanbanWebhookRequest(BaseModel):
    tenant_id: str
    telefone: str
    instancia: str
    status: str
    nome_paciente: Optional[str] = ""
    profissional: Optional[str] = ""
    ultima_mensagem: Optional[str] = ""
    origem: Optional[str] = "automatico"


@router.post("/kanban")
async def kanban_webhook(body: KanbanWebhookRequest, request: Request):
    try:
        await validate_webhook(request, body.tenant_id)
    except Exception:
        # Allow with default secret for n8n testing
        secret = request.headers.get("x-webhook-secret", "")
        if secret != WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Não autorizado")

    now = datetime.now(timezone.utc).isoformat()
    tenant_id = body.tenant_id

    existing = await db.cp_kanban_cards.find_one({
        "tenant_id": tenant_id,
        "telefone": body.telefone
    })

    if existing:
        status_anterior = existing.get("status")
        await db.cp_kanban_cards.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "status": body.status,
                "ultima_mensagem": body.ultima_mensagem or existing.get("ultima_mensagem"),
                "nome_paciente": body.nome_paciente or existing.get("nome_paciente"),
                "ultima_atividade": now,
                "tempo_no_status_desde": now if body.status != status_anterior else existing.get("tempo_no_status_desde"),
            }}
        )
        card_id = str(existing["_id"])
    else:
        status_anterior = None
        result = await db.cp_kanban_cards.insert_one({
            "tenant_id": tenant_id,
            "telefone": body.telefone,
            "instancia": body.instancia,
            "nome_paciente": body.nome_paciente,
            "status": body.status,
            "ultima_mensagem": body.ultima_mensagem,
            "ultima_atividade": now,
            "tempo_no_status_desde": now,
            "criado_em": now,
        })
        card_id = str(result.inserted_id)

    # Historico
    await db.cp_kanban_historico.insert_one({
        "tenant_id": tenant_id,
        "card_id": card_id,
        "status_anterior": status_anterior,
        "status_novo": body.status,
        "origem": body.origem,
        "motivo": f"Atualizado via webhook - {body.profissional or ''}",
        "timestamp": now,
    })

    # WS notify
    card = await db.cp_kanban_cards.find_one({"_id": ObjectId(card_id)}) if card_id else None
    await manager.broadcast(tenant_id, {
        "event": "kanban_atualizado",
        "data": {
            "tenant_id": tenant_id,
            "telefone": body.telefone,
            "status_anterior": status_anterior,
            "status_novo": body.status,
            "card": doc(card) if card else None,
        }
    })

    return {"ok": True}


class EscalacaoWebhookRequest(BaseModel):
    tenant_id: str
    telefone: str
    instancia: str
    mensagem: Optional[str] = ""
    nome_paciente: Optional[str] = ""


@router.post("/escalacao")
async def escalacao_webhook(body: EscalacaoWebhookRequest, request: Request):
    try:
        await validate_webhook(request, body.tenant_id)
    except Exception:
        secret = request.headers.get("x-webhook-secret", "")
        if secret != WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Não autorizado")

    now = datetime.now(timezone.utc).isoformat()
    tenant_id = body.tenant_id

    result = await db.cp_escalacoes.insert_one({
        "tenant_id": tenant_id,
        "telefone": body.telefone,
        "instancia": body.instancia,
        "motivo": body.mensagem,
        "nome_paciente": body.nome_paciente,
        "recebido_em": now,
        "assumido_em": None,
        "resolvido_em": None,
        "operador_id": None,
    })

    # Update kanban
    await db.cp_kanban_cards.update_one(
        {"tenant_id": tenant_id, "telefone": body.telefone},
        {"$set": {
            "status": "aguardando_humano",
            "ultima_atividade": now,
            "tempo_no_status_desde": now,
        }},
        upsert=False
    )

    # WS notify
    await manager.broadcast(tenant_id, {
        "event": "nova_escalacao",
        "data": {
            "tenant_id": tenant_id,
            "telefone": body.telefone,
            "nome_paciente": body.nome_paciente,
            "motivo": body.mensagem,
            "timestamp": now,
            "escalacao_id": str(result.inserted_id),
        }
    })

    # Web Push notification (best-effort)
    try:
        await ps.broadcast_to_tenant(
            tenant_id=tenant_id,
            title=f"Escalação — {body.nome_paciente or body.telefone}",
            body=(body.mensagem or "Paciente solicita atendimento humano")[:140],
            url=f"/conversas/{body.telefone}",
        )
    except Exception as e:
        logger.warning(f"Push broadcast failed: {e}")

    # Telegram Notification (if configured)
    telegram_bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    config_entry = await db.cp_tenant_config.find_one({"tenant_id": tenant_id, "chave": "telegram_chat_id"})
    if telegram_bot_token and config_entry and config_entry.get("valor"):
        import httpx
        chat_id = config_entry["valor"]
        text = f"⚠️ *Escalação de Atendimento*\n\n*Paciente:* {body.nome_paciente or body.telefone}\n*Telefone:* {body.telefone}\n*Instância:* {body.instancia}\n\n*Mensagem:* {body.mensagem}"
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"https://api.telegram.org/bot{telegram_bot_token}/sendMessage",
                    json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
                )
        except Exception as e:
            logger.warning(f"Telegram broadcast failed: {e}")

    return {"ok": True}



class WSNotifyRequest(BaseModel):
    tenant_id: str
    event: str
    data: dict


@router.post("/ws/notify")
async def ws_notify(body: WSNotifyRequest, request: Request):
    secret = request.headers.get("x-webhook-secret", "")
    if secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Não autorizado")
    await manager.broadcast(body.tenant_id, {"event": body.event, "data": body.data})
    return {"ok": True}


# ============== Stripe Webhook ==============

@router.post("/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events to update tenant subscription state."""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    api_key = os.environ.get("STRIPE_API_KEY") or os.environ.get("STRIPE_SECRET_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Stripe não configurado")

    body_bytes = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    host_url = (os.environ.get("BACKEND_PUBLIC_URL") or str(request.base_url)).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    sc = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    try:
        evt = await sc.handle_webhook(body_bytes, signature)
    except Exception as e:
        logger.warning(f"Stripe webhook parse error: {e}")
        # Still return 200 to avoid retries but log
        return {"ok": False, "error": str(e)}

    now = datetime.now(timezone.utc).isoformat()
    session_id = getattr(evt, "session_id", None)
    payment_status = getattr(evt, "payment_status", None)
    metadata = getattr(evt, "metadata", {}) or {}
    event_type = getattr(evt, "event_type", None)

    if not session_id:
        return {"ok": True, "ignored": True}

    txn = await db.payment_transactions.find_one({"session_id": session_id})
    if not txn:
        logger.warning(f"Stripe webhook: txn not found for session {session_id}")
        return {"ok": True, "ignored": True}

    update = {"atualizado_em": now, "webhook_event": event_type}
    if payment_status:
        update["payment_status"] = payment_status

    if payment_status == "paid" and txn.get("payment_status") != "paid":
        plano = txn.get("plano") or metadata.get("plano")
        tenant_id = txn.get("tenant_id") or metadata.get("tenant_id")
        if tenant_id and plano:
            try:
                await db.cp_tenants.update_one(
                    {"_id": ObjectId(tenant_id)},
                    {"$set": {
                        "plano": plano,
                        "status": "ativo",
                        "stripe_session_id": session_id,
                        "plano_ativado_em": now,
                        "atualizado_em": now,
                    }},
                )
                await db.cp_audit_log.insert_one({
                    "tenant_id": tenant_id,
                    "acao": "stripe_webhook_paid",
                    "entidade": "tenant",
                    "entidade_id": tenant_id,
                    "metadata": {"session_id": session_id, "plano": plano, "event": event_type},
                    "timestamp": now,
                })
            except Exception as e:
                logger.exception(f"Failed to upgrade tenant: {e}")

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": update},
    )

    return {"ok": True}
