"""Evolution API client - WhatsApp message sending."""
import os
import logging
import httpx

logger = logging.getLogger(__name__)

EVOLUTION_API_URL = os.environ.get("EVOLUTION_API_URL", "").rstrip("/")
EVOLUTION_API_KEY = os.environ.get("EVOLUTION_API_KEY", "")


async def send_whatsapp_message(instance: str, phone: str, text: str) -> dict:
    """Send a text message via Evolution API.

    Args:
        instance: name of the Evolution instance (per tenant)
        phone: destination phone (digits, e.g., 5511999998888)
        text: message body

    Returns:
        dict with `ok`, `status_code`, and `data` (or `error`).
    """
    if not EVOLUTION_API_URL or not EVOLUTION_API_KEY:
        return {"ok": False, "error": "Evolution API não configurada"}

    url = f"{EVOLUTION_API_URL}/message/sendText/{instance}"
    headers = {
        "apikey": EVOLUTION_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {"number": phone, "text": text}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, headers=headers, json=payload)
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
            ok = 200 <= r.status_code < 300
            if not ok:
                logger.warning(f"Evolution API error {r.status_code}: {data}")
            return {"ok": ok, "status_code": r.status_code, "data": data}
    except httpx.HTTPError as e:
        logger.exception("Evolution API request failed")
        return {"ok": False, "error": str(e)}


async def check_evolution_health() -> dict:
    """Probe Evolution API base URL."""
    if not EVOLUTION_API_URL:
        return {"online": False, "error": "URL não configurada"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(EVOLUTION_API_URL, headers={"apikey": EVOLUTION_API_KEY})
            return {"online": r.status_code < 500, "status_code": r.status_code}
    except Exception as e:
        return {"online": False, "error": str(e)}
