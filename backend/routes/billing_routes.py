"""Stripe billing routes - Subscriptions/Checkout per tenant.

Uses emergentintegrations StripeCheckout abstraction.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os
import logging

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)

from database import db, doc, docs
from auth import require_admin, require_super_admin
from bson import ObjectId

logger = logging.getLogger(__name__)
router = APIRouter()

STRIPE_API_KEY = (
    os.environ.get("STRIPE_API_KEY")
    or os.environ.get("STRIPE_SECRET_KEY")
    or ""
)

# Fixed plans -- defined server-side to prevent price tampering
PLANOS = {
    "starter": {"nome": "Starter", "amount": 99.00, "currency": "brl", "limite_conversas": 500},
    "pro":     {"nome": "Pro",     "amount": 299.00, "currency": "brl", "limite_conversas": 2000},
    "enterprise": {"nome": "Enterprise", "amount": 799.00, "currency": "brl", "limite_conversas": -1},
}


def _stripe(request: Request) -> StripeCheckout:
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe não configurado")
    host_url = (os.environ.get("BACKEND_PUBLIC_URL") or str(request.base_url)).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


@router.get("/plans")
async def list_plans():
    return {"plans": [{"id": k, **v} for k, v in PLANOS.items()]}


class CheckoutRequest(BaseModel):
    plano: str  # starter | pro | enterprise
    origin_url: str  # frontend origin (window.location.origin)


@router.post("/checkout")
async def create_checkout(body: CheckoutRequest, request: Request, user: dict = Depends(require_admin)):
    if body.plano not in PLANOS:
        raise HTTPException(status_code=400, detail="Plano inválido")

    plano = PLANOS[body.plano]
    tenant_id = user["tenant_id"]
    tenant = await db.cp_tenants.find_one({"_id": ObjectId(tenant_id)})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/configuracoes"

    metadata = {
        "tenant_id": tenant_id,
        "tenant_nome": tenant.get("nome", ""),
        "plano": body.plano,
        "operador_id": user["sub"],
    }

    stripe_checkout = _stripe(request)
    checkout_request = CheckoutSessionRequest(
        amount=float(plano["amount"]),
        currency=plano["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    try:
        session = await stripe_checkout.create_checkout_session(checkout_request)
    except Exception as e:
        logger.exception("Stripe create_checkout_session failed")
        raise HTTPException(status_code=502, detail=f"Erro Stripe: {e}")

    now = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.insert_one({
        "tenant_id": tenant_id,
        "session_id": session.session_id,
        "amount": float(plano["amount"]),
        "currency": plano["currency"],
        "plano": body.plano,
        "metadata": metadata,
        "payment_status": "pending",
        "status": "initiated",
        "criado_em": now,
        "atualizado_em": now,
    })

    return {"url": session.url, "session_id": session.session_id}


@router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request, user: dict = Depends(require_admin)):
    tenant_id = user["tenant_id"]
    txn = await db.payment_transactions.find_one({"session_id": session_id, "tenant_id": tenant_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    # If already finalised, return cached
    if txn.get("payment_status") in ("paid", "failed", "expired"):
        return {
            "session_id": session_id,
            "payment_status": txn["payment_status"],
            "status": txn.get("status"),
            "plano": txn.get("plano"),
        }

    # Try emergentintegrations first; fall back to direct Stripe SDK on validation issues
    payment_status = None
    status = None
    amount_total = None
    currency = None

    try:
        stripe_checkout = _stripe(request)
        ck = await stripe_checkout.get_checkout_status(session_id)
        payment_status = ck.payment_status
        status = ck.status
        amount_total = ck.amount_total
        currency = ck.currency
    except Exception as e:
        logger.warning(f"emergent get_checkout_status failed, falling back to stripe SDK: {e}")
        try:
            import stripe as stripe_sdk
            stripe_sdk.api_key = STRIPE_API_KEY
            sess = stripe_sdk.checkout.Session.retrieve(session_id)
            payment_status = getattr(sess, "payment_status", None)
            status = getattr(sess, "status", None)
            amount_total = getattr(sess, "amount_total", None)
            currency = getattr(sess, "currency", None)
        except Exception as e2:
            logger.exception("Stripe SDK fallback also failed")
            raise HTTPException(status_code=502, detail=f"Erro Stripe: {e2}")

    now = datetime.now(timezone.utc).isoformat()
    update = {
        "payment_status": payment_status,
        "status": status,
        "atualizado_em": now,
    }

    # Idempotent: only upgrade tenant if not already done
    if payment_status == "paid" and txn.get("payment_status") != "paid":
        plano = txn.get("plano")
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
            "operador_id": txn.get("metadata", {}).get("operador_id"),
            "acao": "stripe_payment_paid",
            "entidade": "tenant",
            "entidade_id": tenant_id,
            "metadata": {"session_id": session_id, "plano": plano},
            "timestamp": now,
        })

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": update},
    )

    return {
        "session_id": session_id,
        "payment_status": payment_status,
        "status": status,
        "amount_total": amount_total,
        "currency": currency,
        "plano": txn.get("plano"),
    }


@router.get("/transactions")
async def list_transactions(user: dict = Depends(require_admin), limit: int = 20):
    tenant_id = user["tenant_id"]
    txns = await db.payment_transactions.find({"tenant_id": tenant_id}).sort("criado_em", -1).limit(limit).to_list(limit)
    return {"transactions": docs(txns)}


# ============ Super-Admin: global view ============

@router.get("/admin/transactions")
async def admin_list_transactions(user: dict = Depends(require_super_admin), limit: int = 100):
    txns = await db.payment_transactions.find({}).sort("criado_em", -1).limit(limit).to_list(limit)
    # Enrich with tenant name
    result = []
    for t in txns:
        d = doc(t)
        try:
            tenant = await db.cp_tenants.find_one({"_id": ObjectId(t.get("tenant_id"))})
            d["tenant_nome"] = tenant.get("nome") if tenant else None
        except Exception:
            d["tenant_nome"] = None
        result.append(d)
    return {"transactions": result}
