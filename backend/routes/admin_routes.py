from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import db, doc, docs
from auth import require_super_admin, create_token, hash_pwd
from datetime import datetime, timezone
from bson import ObjectId
import secrets
import httpx

router = APIRouter()


@router.get("/tenants")
async def list_tenants(user: dict = Depends(require_super_admin)):
    tenants = await db.cp_tenants.find({}).sort("criado_em", -1).to_list(200)
    result = []
    for t in tenants:
        d = doc(t)
        d["total_conversas"] = await db.cp_kanban_cards.count_documents({"tenant_id": str(t["_id"])})
        d["escalacoes_abertas"] = await db.cp_escalacoes.count_documents({
            "tenant_id": str(t["_id"]), "resolvido_em": None
        })
        result.append(d)
    return {"tenants": result}


@router.get("/tenants/{tenant_id}")
async def get_tenant(tenant_id: str, user: dict = Depends(require_super_admin)):
    try:
        tenant = await db.cp_tenants.find_one({"_id": ObjectId(tenant_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    operadores = await db.cp_operadores.find(
        {"tenant_id": tenant_id}, {"senha_hash": 0}
    ).to_list(50)
    profissionais = await db.cp_profissionais.find({"tenant_id": tenant_id}).to_list(50)

    return {
        "tenant": doc(tenant),
        "operadores": docs(operadores),
        "profissionais": docs(profissionais),
    }


class TenantCreateRequest(BaseModel):
    nome: str
    slug: str
    cnpj: Optional[str] = ""
    email_contato: Optional[str] = ""
    telefone_contato: Optional[str] = ""
    plano: str = "trial"
    instancia_evolution: str
    url_n8n: Optional[str] = ""
    url_evolution: Optional[str] = ""
    admin_nome: str
    admin_email: str
    admin_senha: str


@router.post("/tenants")
async def create_tenant(body: TenantCreateRequest, user: dict = Depends(require_super_admin)):
    # Check slug uniqueness
    existing = await db.cp_tenants.find_one({"slug": body.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Slug já existe")

    now = datetime.now(timezone.utc).isoformat()
    webhook_secret = secrets.token_hex(20)

    result = await db.cp_tenants.insert_one({
        "nome": body.nome,
        "slug": body.slug,
        "cnpj": body.cnpj,
        "email_contato": body.email_contato,
        "telefone_contato": body.telefone_contato,
        "plano": body.plano,
        "status": "ativo",
        "instancia_evolution": body.instancia_evolution,
        "webhook_secret": webhook_secret,
        "url_n8n": body.url_n8n,
        "url_evolution": body.url_evolution,
        "criado_em": now,
        "atualizado_em": now,
    })

    tenant_id = str(result.inserted_id)

    # Create admin operator
    await db.cp_operadores.insert_one({
        "tenant_id": tenant_id,
        "nome": body.admin_nome,
        "email": body.admin_email,
        "senha_hash": hash_pwd(body.admin_senha),
        "nivel": "admin",
        "ativo": True,
        "criado_em": now,
    })

    # Default config
    default_configs = [
        {"chave": "horario_inicio", "valor": "08:00"},
        {"chave": "horario_fim", "valor": "18:00"},
        {"chave": "mensagem_fora_horario", "valor": "Olá! Nossa secretária virtual atende de 8h às 18h. Retornaremos em breve."},
        {"chave": "sla_resposta_humana", "valor": "5"},
    ]
    for c in default_configs:
        await db.cp_tenant_config.insert_one({"tenant_id": tenant_id, **c})

    tenant = await db.cp_tenants.find_one({"_id": result.inserted_id})
    return {"tenant": doc(tenant), "webhook_secret": webhook_secret}


class TenantUpdateRequest(BaseModel):
    nome: Optional[str] = None
    plano: Optional[str] = None
    status: Optional[str] = None
    email_contato: Optional[str] = None
    url_n8n: Optional[str] = None
    url_evolution: Optional[str] = None


@router.patch("/tenants/{tenant_id}")
async def update_tenant(tenant_id: str, body: TenantUpdateRequest, user: dict = Depends(require_super_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    try:
        await db.cp_tenants.update_one({"_id": ObjectId(tenant_id)}, {"$set": updates})
    except Exception:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    tenant = await db.cp_tenants.find_one({"_id": ObjectId(tenant_id)})
    return {"tenant": doc(tenant)}


@router.post("/tenants/{tenant_id}/impersonate")
async def impersonate_tenant(tenant_id: str, user: dict = Depends(require_super_admin)):
    try:
        tenant = await db.cp_tenants.find_one({"_id": ObjectId(tenant_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    # Get first admin of tenant
    admin_op = await db.cp_operadores.find_one({"tenant_id": tenant_id, "nivel": "admin", "ativo": True})
    if not admin_op:
        admin_op = await db.cp_operadores.find_one({"tenant_id": tenant_id, "ativo": True})
    if not admin_op:
        raise HTTPException(status_code=400, detail="Nenhum operador ativo neste tenant")

    token = create_token({
        "sub": str(admin_op["_id"]),
        "tenant_id": tenant_id,
        "nome": admin_op["nome"],
        "email": admin_op["email"],
        "role": admin_op["nivel"],
        "impersonado_por": user["sub"],
    }, hours=2)

    # Audit log
    await db.cp_audit_log.insert_one({
        "tenant_id": tenant_id,
        "super_admin_id": user["sub"],
        "acao": "impersonation",
        "entidade": "tenant",
        "entidade_id": tenant_id,
        "impersonado": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "access_token": token,
        "tenant_nome": tenant["nome"],
        "operador_nome": admin_op["nome"],
    }


@router.get("/metricas-globais")
async def metricas_globais(user: dict = Depends(require_super_admin)):
    total_tenants = await db.cp_tenants.count_documents({})
    tenants_ativos = await db.cp_tenants.count_documents({"status": "ativo"})
    tenants_trial = await db.cp_tenants.count_documents({"status": "trial"})
    total_conversas = await db.cp_kanban_cards.count_documents({})
    escalacoes_hoje = await db.cp_escalacoes.count_documents({"resolvido_em": None})
    total_agendados = await db.cp_kanban_cards.count_documents({
        "status": {"$in": ["agendado", "confirmado"]}
    })

    # Usage per tenant
    tenants = await db.cp_tenants.find({}).to_list(50)
    uso_por_tenant = []
    for t in tenants:
        tid = str(t["_id"])
        count = await db.cp_kanban_cards.count_documents({"tenant_id": tid})
        uso_por_tenant.append({
            "nome": t["nome"],
            "slug": t["slug"],
            "conversas": count,
            "plano": t.get("plano"),
            "status": t.get("status"),
        })

    return {
        "total_tenants": total_tenants,
        "tenants_ativos": tenants_ativos,
        "tenants_trial": tenants_trial,
        "total_conversas": total_conversas,
        "escalacoes_abertas": escalacoes_hoje,
        "total_agendados": total_agendados,
        "uso_por_tenant": uso_por_tenant,
    }


@router.get("/logs")
async def global_logs(
    tenant_id: str = "",
    acao: str = "",
    limit: int = 100,
    user: dict = Depends(require_super_admin)
):
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    if acao:
        query["acao"] = acao

    logs = await db.cp_audit_log.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"logs": docs(logs)}


@router.get("/health")
async def health_check(user: dict = Depends(require_super_admin)):
    services = []

    # MongoDB check
    try:
        await db.command("ping")
        services.append({"nome": "MongoDB", "status": "online", "latencia": "< 5ms"})
    except Exception as e:
        services.append({"nome": "MongoDB", "status": "offline", "erro": str(e)})

    # Evolution API check
    import os as _os
    evo_url = _os.environ.get("EVOLUTION_API_URL", "")
    evo_key = _os.environ.get("EVOLUTION_API_KEY", "")
    if evo_url and evo_key:
        try:
            async with httpx.AsyncClient(timeout=5.0) as cli:
                r = await cli.get(evo_url, headers={"apikey": evo_key})
                services.append({
                    "nome": "Evolution API",
                    "status": "online" if r.status_code < 500 else "degraded",
                    "status_code": r.status_code,
                    "url": evo_url,
                })
        except Exception as e:
            services.append({"nome": "Evolution API", "status": "offline", "erro": str(e)})
    else:
        services.append({"nome": "Evolution API", "status": "nao_configurado"})

    # n8n
    n8n_url = _os.environ.get("N8N_URL", "")
    if n8n_url:
        try:
            async with httpx.AsyncClient(timeout=5.0) as cli:
                r = await cli.get(n8n_url)
                services.append({"nome": "n8n", "status": "online" if r.status_code < 500 else "degraded", "url": n8n_url})
        except Exception as e:
            services.append({"nome": "n8n", "status": "offline", "erro": str(e)})
    else:
        services.append({"nome": "n8n", "status": "nao_configurado"})

    # Google OAuth (config-only check)
    if _os.environ.get("GOOGLE_CLIENT_ID") and _os.environ.get("GOOGLE_CLIENT_SECRET"):
        services.append({"nome": "Google Calendar OAuth", "status": "configurado"})
    else:
        services.append({"nome": "Google Calendar OAuth", "status": "nao_configurado"})

    # Stripe (config-only check)
    if _os.environ.get("STRIPE_API_KEY") or _os.environ.get("STRIPE_SECRET_KEY"):
        services.append({"nome": "Stripe", "status": "configurado"})
    else:
        services.append({"nome": "Stripe", "status": "nao_configurado"})

    # VAPID
    if _os.environ.get("VAPID_PUBLIC_KEY") and _os.environ.get("VAPID_PRIVATE_KEY"):
        services.append({"nome": "Web Push (VAPID)", "status": "configurado"})
    else:
        services.append({"nome": "Web Push (VAPID)", "status": "nao_configurado"})

    return {"services": services, "timestamp": datetime.now(timezone.utc).isoformat()}
