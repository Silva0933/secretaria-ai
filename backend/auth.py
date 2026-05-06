from passlib.context import CryptContext
from jose import jwt, JWTError
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta, timezone
from database import db
from bson import ObjectId
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.environ.get('JWT_SECRET', 'cp_secret_2026')
ALGO = "HS256"
bearer = HTTPBearer(auto_error=False)


def hash_pwd(p: str) -> str:
    return pwd_context.hash(p)


def verify_pwd(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(data: dict, hours: int = 8) -> str:
    d = {**data, "exp": datetime.now(timezone.utc) + timedelta(hours=hours)}
    return jwt.encode(d, JWT_SECRET, algorithm=ALGO)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[ALGO])


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    exc = HTTPException(status_code=401, detail="Token inválido ou expirado")
    if not creds:
        raise exc
    try:
        payload = decode_token(creds.credentials)
        return payload
    except JWTError:
        raise exc


async def require_operador(user: dict = Depends(get_current_user)):
    if user.get("role") not in ("admin", "operador", "super_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    return user


async def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Acesso restrito a admins")
    return user


async def require_super_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao Super-Admin")
    return user
