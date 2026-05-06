from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import db, doc, docs
from auth import require_operador
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage
import os

router = APIRouter()

SYSTEM_PROMPT = """Você é um assistente interno de clínica médica altamente eficiente.
Você ajuda gestores e recepcionistas com tarefas administrativas como:
- Consultar e resumir informações da agenda
- Auxiliar com reagendamentos
- Responder dúvidas sobre procedimentos de atendimento
- Fornecer estatísticas de atendimento
- Ajudar com comunicações com pacientes

Responda sempre em português brasileiro. Seja conciso, profissional e útil.
Formate respostas com markdown quando apropriado (listas, negrito, etc.)."""


class AssistenteRequest(BaseModel):
    mensagem: str


@router.post("")
async def send_message(body: AssistenteRequest, user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]
    operador_id = user["sub"]
    now = datetime.now(timezone.utc).isoformat()

    # Get last 10 messages for context
    historico = await db.cp_assistente_historico.find({
        "tenant_id": tenant_id,
        "operador_id": operador_id,
    }).sort("timestamp", -1).limit(10).to_list(10)
    historico.reverse()

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    session_id = f"assistente_{tenant_id}_{operador_id}"

    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=SYSTEM_PROMPT
    ).with_model("gemini", "gemini-2.5-flash")

    # Rebuild history in chat
    for h in historico:
        if h.get("mensagem") and h.get("resposta"):
            await chat.send_message(UserMessage(text=h["mensagem"]))

    user_msg = UserMessage(text=body.mensagem)
    try:
        resposta = await chat.send_message(user_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no assistente IA: {str(e)}")

    # Persist
    await db.cp_assistente_historico.insert_one({
        "tenant_id": tenant_id,
        "operador_id": operador_id,
        "mensagem": body.mensagem,
        "resposta": resposta,
        "timestamp": now,
    })

    return {"resposta": resposta, "timestamp": now}


@router.get("/historico")
async def get_historico(user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]
    operador_id = user["sub"]

    historico = await db.cp_assistente_historico.find({
        "tenant_id": tenant_id,
        "operador_id": operador_id,
    }).sort("timestamp", 1).to_list(100)

    return {"historico": docs(historico)}
