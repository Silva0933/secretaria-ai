from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import db, doc, docs
from auth import require_operador
from datetime import datetime, timezone
from bson import ObjectId
from ws_manager import manager
from services.evolution import send_whatsapp_message
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("")
async def list_conversas(
    status: str = "",
    busca: str = "",
    user: dict = Depends(require_operador)
):
    tenant_id = user["tenant_id"]
    query = {"tenant_id": tenant_id}
    if status:
        query["status"] = status
    if busca:
        query["$or"] = [
            {"nome_paciente": {"$regex": busca, "$options": "i"}},
            {"telefone": {"$regex": busca}},
        ]

    cards = await db.cp_kanban_cards.find(query).sort("ultima_atividade", -1).to_list(200)
    result = []
    for c in cards:
        d = doc(c)
        # Check if human is active
        human = await db.cp_atendimento_humano.find_one({
            "tenant_id": tenant_id,
            "telefone": c.get("telefone"),
            "ativo": True
        })
        d["humano_ativo"] = bool(human)
        d["operador_responsavel_nome"] = None
        if human and human.get("operador_id"):
            op = await db.cp_operadores.find_one({"_id": ObjectId(human["operador_id"])})
            d["operador_responsavel_nome"] = op["nome"] if op else None
        result.append(d)

    return {"conversas": result}


@router.get("/{telefone}")
async def get_conversa(telefone: str, user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]

    card = await db.cp_kanban_cards.find_one({"tenant_id": tenant_id, "telefone": telefone})
    if not card:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")

    mensagens = await db.cp_mensagens.find({
        "tenant_id": tenant_id,
        "telefone": telefone
    }).sort("enviado_em", 1).to_list(500)

    human = await db.cp_atendimento_humano.find_one({
        "tenant_id": tenant_id, "telefone": telefone, "ativo": True
    })
    humano_ativo = bool(human)
    operador_nome = None
    if human and human.get("operador_id"):
        op = await db.cp_operadores.find_one({"_id": ObjectId(human["operador_id"])})
        operador_nome = op["nome"] if op else None

    # Profissional
    profissional = None
    if card.get("profissional_id"):
        try:
            prof = await db.cp_profissionais.find_one({"_id": ObjectId(card["profissional_id"])})
            if prof:
                profissional = {"id": str(prof["_id"]), "nome": prof["nome"], "especialidade": prof.get("especialidade")}
        except Exception:
            pass

    return {
        "card": doc(card),
        "mensagens": docs(mensagens),
        "humano_ativo": humano_ativo,
        "operador_nome": operador_nome,
        "profissional": profissional,
    }


@router.post("/{telefone}/assumir")
async def assumir_conversa(telefone: str, user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]
    now = datetime.now(timezone.utc).isoformat()

    # Deactivate any existing
    await db.cp_atendimento_humano.update_many(
        {"tenant_id": tenant_id, "telefone": telefone, "ativo": True},
        {"$set": {"ativo": False, "encerrado_em": now}}
    )

    # Create new
    await db.cp_atendimento_humano.insert_one({
        "tenant_id": tenant_id,
        "telefone": telefone,
        "ativo": True,
        "operador_id": user["sub"],
        "assumido_em": now,
        "encerrado_em": None,
    })

    # Update kanban card
    await db.cp_kanban_cards.update_one(
        {"tenant_id": tenant_id, "telefone": telefone},
        {"$set": {"ultima_atividade": now}}
    )

    # Audit log
    await db.cp_audit_log.insert_one({
        "tenant_id": tenant_id,
        "operador_id": user["sub"],
        "acao": "assumiu_conversa",
        "entidade": "conversa",
        "entidade_id": telefone,
        "timestamp": now,
    })

    await manager.broadcast(tenant_id, {
        "event": "conversa_assumida",
        "data": {"telefone": telefone, "operador_nome": user.get("nome"), "tenant_id": tenant_id}
    })

    return {"ok": True, "message": "Conversa assumida com sucesso"}


@router.post("/{telefone}/devolver")
async def devolver_conversa(telefone: str, user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]
    now = datetime.now(timezone.utc).isoformat()

    await db.cp_atendimento_humano.update_many(
        {"tenant_id": tenant_id, "telefone": telefone, "ativo": True},
        {"$set": {"ativo": False, "encerrado_em": now}}
    )

    await db.cp_audit_log.insert_one({
        "tenant_id": tenant_id,
        "operador_id": user["sub"],
        "acao": "devolveu_conversa",
        "entidade": "conversa",
        "entidade_id": telefone,
        "timestamp": now,
    })

    await manager.broadcast(tenant_id, {
        "event": "conversa_devolvida",
        "data": {"telefone": telefone, "tenant_id": tenant_id}
    })

    return {"ok": True, "message": "Conversa devolvida para a IA"}


class EnviarMensagemRequest(BaseModel):
    mensagem: str


@router.post("/{telefone}/enviar")
async def enviar_mensagem(telefone: str, body: EnviarMensagemRequest, user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]
    now = datetime.now(timezone.utc).isoformat()

    # Resolve tenant for Evolution instance
    try:
        tenant = await db.cp_tenants.find_one({"_id": ObjectId(tenant_id)})
    except Exception:
        tenant = None

    instancia = tenant.get("instancia_evolution") if tenant else None

    # Send via Evolution API (real WhatsApp)
    evo_result = {"ok": False, "error": "instancia não configurada"}
    if instancia:
        evo_result = await send_whatsapp_message(instancia, telefone, body.mensagem)
        if not evo_result.get("ok"):
            logger.warning(f"Evolution send failed for tenant={tenant_id} phone={telefone}: {evo_result}")

    # Store message regardless (so operator sees feedback locally)
    await db.cp_mensagens.insert_one({
        "tenant_id": tenant_id,
        "telefone": telefone,
        "tipo": "operador",
        "conteudo": body.mensagem,
        "operador_id": user["sub"],
        "operador_nome": user.get("nome", "Operador"),
        "enviado_em": now,
        "evolution_status": "ok" if evo_result.get("ok") else "falha",
        "evolution_response": evo_result.get("data") if evo_result.get("ok") else evo_result.get("error"),
    })

    # Update last activity
    await db.cp_kanban_cards.update_one(
        {"tenant_id": tenant_id, "telefone": telefone},
        {"$set": {"ultima_mensagem": body.mensagem, "ultima_atividade": now}}
    )

    # Broadcast via WebSocket
    await manager.broadcast(tenant_id, {
        "event": "nova_mensagem",
        "data": {
            "tenant_id": tenant_id,
            "telefone": telefone,
            "mensagem": body.mensagem,
            "tipo": "operador",
            "operador_nome": user.get("nome"),
            "enviado_em": now,
        }
    })

    if not evo_result.get("ok"):
        # Surface delivery error to operator
        return {
            "ok": False,
            "message": "Mensagem salva, mas Evolution API falhou",
            "error": evo_result.get("error") or evo_result.get("data"),
        }

    return {"ok": True, "message": "Mensagem enviada"}
