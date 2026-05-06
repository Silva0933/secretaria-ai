from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import db, doc, docs
from auth import require_operador, require_admin, hash_pwd
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter()


@router.get("")
async def get_config(user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]
    tenant = await db.cp_tenants.find_one({"_id": ObjectId(tenant_id)})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    configs_raw = await db.cp_tenant_config.find({"tenant_id": tenant_id}).to_list(100)
    config_map = {c["chave"]: c["valor"] for c in configs_raw}

    return {
        "tenant": doc(tenant),
        "config": config_map,
    }


class ConfigUpdateRequest(BaseModel):
    chave: str
    valor: str


@router.patch("")
async def update_config(body: ConfigUpdateRequest, user: dict = Depends(require_admin)):
    tenant_id = user["tenant_id"]
    await db.cp_tenant_config.update_one(
        {"tenant_id": tenant_id, "chave": body.chave},
        {"$set": {"valor": body.valor}},
        upsert=True
    )
    return {"ok": True}


# Profissionais
@router.get("/profissionais")
async def list_profissionais(user: dict = Depends(require_operador)):
    tenant_id = user["tenant_id"]
    profs = await db.cp_profissionais.find({"tenant_id": tenant_id}).to_list(50)
    return {"profissionais": docs(profs)}


class ProfissionalRequest(BaseModel):
    nome: str
    especialidade: Optional[str] = ""
    tipo: Optional[str] = "medico"
    calendar_id: Optional[str] = ""
    ativo: Optional[bool] = True


@router.post("/profissionais")
async def create_profissional(body: ProfissionalRequest, user: dict = Depends(require_admin)):
    tenant_id = user["tenant_id"]
    now = datetime.now(timezone.utc).isoformat()
    result = await db.cp_profissionais.insert_one({
        "tenant_id": tenant_id,
        **body.model_dump(),
        "criado_em": now,
    })
    prof = await db.cp_profissionais.find_one({"_id": result.inserted_id})
    return {"profissional": doc(prof)}


@router.put("/profissionais/{prof_id}")
async def update_profissional(prof_id: str, body: ProfissionalRequest, user: dict = Depends(require_admin)):
    tenant_id = user["tenant_id"]
    try:
        await db.cp_profissionais.update_one(
            {"_id": ObjectId(prof_id), "tenant_id": tenant_id},
            {"$set": body.model_dump()}
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Profissional não encontrado")
    prof = await db.cp_profissionais.find_one({"_id": ObjectId(prof_id)})
    return {"profissional": doc(prof)}


@router.delete("/profissionais/{prof_id}")
async def delete_profissional(prof_id: str, user: dict = Depends(require_admin)):
    tenant_id = user["tenant_id"]
    try:
        await db.cp_profissionais.delete_one({"_id": ObjectId(prof_id), "tenant_id": tenant_id})
    except Exception:
        raise HTTPException(status_code=404, detail="Profissional não encontrado")
    return {"ok": True}


# Operadores
@router.get("/operadores")
async def list_operadores(user: dict = Depends(require_admin)):
    tenant_id = user["tenant_id"]
    ops = await db.cp_operadores.find({"tenant_id": tenant_id}, {"senha_hash": 0}).to_list(50)
    return {"operadores": docs(ops)}


class OperadorRequest(BaseModel):
    nome: str
    email: str
    senha: str
    nivel: str = "operador"


@router.post("/operadores")
async def create_operador(body: OperadorRequest, user: dict = Depends(require_admin)):
    tenant_id = user["tenant_id"]
    existing = await db.cp_operadores.find_one({"tenant_id": tenant_id, "email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado neste tenant")

    now = datetime.now(timezone.utc).isoformat()
    await db.cp_operadores.insert_one({
        "tenant_id": tenant_id,
        "nome": body.nome,
        "email": body.email,
        "senha_hash": hash_pwd(body.senha),
        "nivel": body.nivel,
        "ativo": True,
        "criado_em": now,
    })
    return {"ok": True}


@router.delete("/operadores/{op_id}")
async def delete_operador(op_id: str, user: dict = Depends(require_admin)):
    tenant_id = user["tenant_id"]
    try:
        await db.cp_operadores.update_one(
            {"_id": ObjectId(op_id), "tenant_id": tenant_id},
            {"$set": {"ativo": False}}
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Operador não encontrado")
    return {"ok": True}
