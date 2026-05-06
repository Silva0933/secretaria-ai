"""Google Calendar OAuth2 + Events service (per-tenant)."""
import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from database import db

logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]


def is_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


def _client_config():
    return {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }


def build_auth_url(redirect_uri: str, state: str) -> str:
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=redirect_uri)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    return auth_url


def exchange_code(redirect_uri: str, code: str) -> dict:
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=redirect_uri)
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": creds.scopes,
        "expiry": creds.expiry.isoformat() if creds.expiry else None,
    }


async def get_credentials_for_tenant(tenant_id: str) -> Optional[Credentials]:
    rec = await db.cp_google_tokens.find_one({"tenant_id": tenant_id})
    if not rec:
        return None
    creds = Credentials(
        token=rec.get("access_token"),
        refresh_token=rec.get("refresh_token"),
        token_uri=rec.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=rec.get("scopes", SCOPES),
    )
    return creds


def _build_service(creds: Credentials):
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


async def list_events(tenant_id: str, calendar_id: str = "primary",
                      time_min: Optional[datetime] = None,
                      time_max: Optional[datetime] = None,
                      max_results: int = 50):
    creds = await get_credentials_for_tenant(tenant_id)
    if not creds:
        return {"ok": False, "error": "Google Calendar não conectado"}

    if time_min is None:
        time_min = datetime.now(timezone.utc)
    if time_max is None:
        time_max = time_min + timedelta(days=30)

    try:
        service = _build_service(creds)
        events = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min.isoformat(),
            timeMax=time_max.isoformat(),
            maxResults=max_results,
            singleEvents=True,
            orderBy="startTime",
        ).execute()
        return {"ok": True, "events": events.get("items", [])}
    except HttpError as e:
        logger.warning(f"Google list_events error: {e}")
        return {"ok": False, "error": str(e)}


async def create_event(tenant_id: str, calendar_id: str,
                       summary: str, start_iso: str, end_iso: str,
                       description: str = "", attendees: Optional[list] = None,
                       time_zone: str = "America/Sao_Paulo"):
    creds = await get_credentials_for_tenant(tenant_id)
    if not creds:
        return {"ok": False, "error": "Google Calendar não conectado"}

    body = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start_iso, "timeZone": time_zone},
        "end": {"dateTime": end_iso, "timeZone": time_zone},
    }
    if attendees:
        body["attendees"] = [{"email": e} for e in attendees]

    try:
        service = _build_service(creds)
        event = service.events().insert(calendarId=calendar_id, body=body).execute()
        return {"ok": True, "event": event}
    except HttpError as e:
        logger.warning(f"Google create_event error: {e}")
        return {"ok": False, "error": str(e)}
