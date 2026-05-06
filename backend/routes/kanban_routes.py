from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import db, doc, docs
from auth import require_operador
from datetime import datetime, timezone
from bson import ObjectId
from ws_manager import manager

router = APIRouter()

KANBAN_COLUMNS = [
    "novo_contato", "em_atendimento", "agendando", "agendado",
    "confirmado", "aguardando_humano", "remarcando", "atendido", "cancelado"
]


@router.get("")
async def get_kanban(user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]
    cards = await db.cp_kanban_cards.find({"tenant_id": tenant_id}).sort("ultima_atividade", -1).to_list(500)

    grouped = {col: [] for col in KANBAN_COLUMNS}
    for c in cards:
        d = doc(c)
        # Enrich with profissional name
        if c.get("profissional_id"):
            try:
                prof = await db.cp_profissionais.find_one({"_id": ObjectId(c["profissional_id"])})
                d["profissional_nome"] = prof["nome"] if prof else None
            except Exception:
                d["profissional_nome"] = None
        status = d.get("status", "novo_contato")
        if status in grouped:
            grouped[status].append(d)
    return {"columns": grouped}


class MoveCardRequest(BaseModel):
    status: str
    motivo: str = ""


@router.patch("/{card_id}/status")
async def move_card(card_id: str, body: MoveCardRequest, user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]
    if body.status not in KANBAN_COLUMNS:
        raise HTTPException(status_code=400, detail="Status inválido")

    try:
        card = await db.cp_kanban_cards.find_one({"_id": ObjectId(card_id), "tenant_id": tenant_id})
    except Exception:
        raise HTTPException(status_code=404, detail="Card não encontrado")

    if not card:
        raise HTTPException(status_code=404, detail="Card não encontrado")

    status_anterior = card.get("status")
    now = datetime.now(timezone.utc).isoformat()

    await db.cp_kanban_cards.update_one(
        {"_id": ObjectId(card_id)},
        {"$set": {
            "status": body.status,
            "ultima_atividade": now,
            "tempo_no_status_desde": now,
        }}
    )

    # Record history
    await db.cp_kanban_historico.insert_one({
        "tenant_id": tenant_id,
        "card_id": card_id,
        "status_anterior": status_anterior,
        "status_novo": body.status,
        "origem": "manual",
        "operador_id": user["sub"],
        "operador_nome": user.get("nome", ""),
        "motivo": body.motivo,
        "timestamp": now,
    })

    # Audit log
    await db.cp_audit_log.insert_one({
        "tenant_id": tenant_id,
        "operador_id": user["sub"],
        "acao": "moveu_kanban",
        "entidade": "kanban_card",
        "entidade_id": card_id,
        "detalhes": {"status_anterior": status_anterior, "status_novo": body.status},
        "timestamp": now,
    })

    # WebSocket broadcast
    updated_card = await db.cp_kanban_cards.find_one({"_id": ObjectId(card_id)})
    await manager.broadcast(tenant_id, {
        "event": "kanban_atualizado",
        "data": {
            "tenant_id": tenant_id,
            "card_id": card_id,
            "status_anterior": status_anterior,
            "status_novo": body.status,
            "card": doc(updated_card),
        }
    })

    return {"ok": True, "status": body.status}


@router.get("/{card_id}/historico")
async def get_card_historico(card_id: str, user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]
    historico = await db.cp_kanban_historico.find({
        "tenant_id": tenant_id,
        "card_id": card_id
    }).sort("timestamp", 1).to_list(100)
    return {"historico": docs(historico)}
