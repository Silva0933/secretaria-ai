from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import db, doc, docs
from auth import require_operador
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter()


@router.get("")
async def list_escalacoes(
    pendente: bool = None,
    user: dict = Depends(require_operador)
):
    tenant_id = user["tenant_id"]
    query = {"tenant_id": tenant_id}
    if pendente is True:
        query["resolvido_em"] = None
    elif pendente is False:
        query["resolvido_em"] = {"$ne": None}

    escalacoes = await db.cp_escalacoes.find(query).sort("recebido_em", -1).to_list(100)
    result = []
    for e in escalacoes:
        d = doc(e)
        if e.get("operador_id"):
            try:
                op = await db.cp_operadores.find_one({"_id": ObjectId(e["operador_id"])})
                d["operador_nome"] = op["nome"] if op else None
            except Exception:
                d["operador_nome"] = None
        result.append(d)
    return {"escalacoes": result}


@router.patch("/{escalacao_id}/resolver")
async def resolver_escalacao(escalacao_id: str, user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]
    now = datetime.now(timezone.utc).isoformat()

    try:
        esc = await db.cp_escalacoes.find_one({
            "_id": ObjectId(escalacao_id),
            "tenant_id": tenant_id
        })
    except Exception:
        raise HTTPException(status_code=404, detail="Escalação não encontrada")

    if not esc:
        raise HTTPException(status_code=404, detail="Escalação não encontrada")

    await db.cp_escalacoes.update_one(
        {"_id": ObjectId(escalacao_id)},
        {"$set": {
            "resolvido_em": now,
            "assumido_em": esc.get("assumido_em") or now,
            "operador_id": user["sub"],
        }}
    )

    # Update kanban
    await db.cp_kanban_cards.update_one(
        {"tenant_id": tenant_id, "telefone": esc.get("telefone")},
        {"$set": {"status": "em_atendimento", "ultima_atividade": now}}
    )

    return {"ok": True}
