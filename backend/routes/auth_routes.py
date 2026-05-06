from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import db, doc
from auth import hash_pwd, verify_pwd, create_token, decode_token, get_current_user, bearer
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials
import pyotp
import os

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    senha: str


class AdminLoginRequest(BaseModel):
    email: str
    senha: str
    totp_code: str = ""


@router.post("/login")
async def login(body: LoginRequest):
    operador = await db.cp_operadores.find_one({"email": body.email, "ativo": True})
    if not operador or not verify_pwd(body.senha, operador["senha_hash"]):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")

    tenant = await db.cp_tenants.find_one({"_id": operador["tenant_id"]}) if operador.get("tenant_id") else None
    if not tenant:
        from bson import ObjectId
        tenant = await db.cp_tenants.find_one({"_id": ObjectId(operador["tenant_id"])}) if operador.get("tenant_id") else None

    # Update last access
    from datetime import datetime, timezone
    await db.cp_operadores.update_one(
        {"_id": operador["_id"]},
        {"$set": {"ultimo_acesso": datetime.now(timezone.utc).isoformat()}}
    )

    token_data = {
        "sub": str(operador["_id"]),
        "tenant_id": str(operador["tenant_id"]),
        "nome": operador["nome"],
        "email": operador["email"],
        "role": operador["nivel"],
    }
    token = create_token(token_data)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(operador["_id"]),
            "nome": operador["nome"],
            "email": operador["email"],
            "role": operador["nivel"],
            "tenant_id": str(operador["tenant_id"]),
            "tenant_nome": tenant["nome"] if tenant else "",
            "tenant_slug": tenant["slug"] if tenant else "",
        }
    }


@router.post("/admin/login")
async def admin_login(body: AdminLoginRequest):
    sa = await db.cp_super_admins.find_one({"email": body.email, "ativo": True})
    if not sa or not verify_pwd(body.senha, sa["senha_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    # TOTP validation
    totp_secret = sa.get("totp_secret", "")
    if totp_secret:
        if not body.totp_code:
            raise HTTPException(status_code=401, detail="Código 2FA obrigatório")
        totp = pyotp.TOTP(totp_secret)
        if not totp.verify(body.totp_code, valid_window=1):
            raise HTTPException(status_code=401, detail="Código 2FA inválido")

    token_data = {
        "sub": str(sa["_id"]),
        "nome": sa["nome"],
        "email": sa["email"],
        "role": "super_admin",
    }
    token = create_token(token_data)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(sa["_id"]),
            "nome": sa["nome"],
            "email": sa["email"],
            "role": "super_admin",
        }
    }


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/logout")
async def logout():
    return {"message": "Logout realizado com sucesso"}
