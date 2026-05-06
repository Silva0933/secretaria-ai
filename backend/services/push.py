"""Web Push notifications via VAPID + pywebpush."""
import os
import json
import logging
from typing import Optional
from pywebpush import webpush, WebPushException
from database import db

logger = logging.getLogger(__name__)

VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_EMAIL = os.environ.get("VAPID_EMAIL", "mailto:admin@example.com")

VAPID_CLAIMS = {"sub": VAPID_EMAIL}


def is_configured() -> bool:
    return bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)


async def send_push(subscription: dict, title: str, body: str, url: Optional[str] = None) -> bool:
    """Send a single push notification to one subscription."""
    if not is_configured():
        logger.warning("VAPID keys not configured")
        return False

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url or "/",
    })
    try:
        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=dict(VAPID_CLAIMS),
        )
        return True
    except WebPushException as e:
        logger.warning(f"WebPush failed: {e}")
        # Subscription expired/gone -> caller can clean up
        if e.response is not None and e.response.status_code in (404, 410):
            return False
        return False
    except Exception as e:
        logger.exception(f"WebPush unexpected error: {e}")
        return False


async def broadcast_to_tenant(tenant_id: str, title: str, body: str, url: Optional[str] = None):
    """Send a push notification to every active subscription of a tenant."""
    if not is_configured():
        return 0

    cursor = db.cp_push_subscriptions.find({"tenant_id": tenant_id, "ativo": True})
    sent = 0
    async for sub in cursor:
        sub_info = {
            "endpoint": sub["endpoint"],
            "keys": sub.get("keys", {}),
        }
        ok = await send_push(sub_info, title, body, url)
        if ok:
            sent += 1
        else:
            # mark inactive on failure
            await db.cp_push_subscriptions.update_one(
                {"_id": sub["_id"]},
                {"$set": {"ativo": False}},
            )
    return sent
