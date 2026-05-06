"""
Backend tests for ClinicaPanel v2.0 — Integrations
Coverage: Stripe billing, Web Push (VAPID), Google OAuth, Evolution send,
super-admin health, Stripe webhook tolerance.
"""
import os
import time
import pytest
import pyotp
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = "admin@clinicamoreira.com"
ADMIN_PWD = "Clinica@123"
OPERADOR_EMAIL = "recep@clinicamoreira.com"
OPERADOR_PWD = "Clinica@123"
SA_EMAIL = "jailson.silva0933@gmail.com"
SA_PWD = "Admin@2026"
SA_TOTP_SECRET = "JBSWY3DPEHPK3PXP"


def _login(email, pwd):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "senha": pwd}, timeout=30)
    if r.status_code == 200:
        return r.json().get("access_token")
    return None


def _login_sa():
    code = pyotp.TOTP(SA_TOTP_SECRET).now()
    r = requests.post(
        f"{BASE_URL}/api/auth/admin/login",
        json={"email": SA_EMAIL, "senha": SA_PWD, "totp_code": code},
        timeout=30,
    )
    if r.status_code == 200:
        return r.json().get("access_token")
    # Try once more with the *next* code in case of edge of window
    time.sleep(2)
    code = pyotp.TOTP(SA_TOTP_SECRET).now()
    r = requests.post(
        f"{BASE_URL}/api/auth/admin/login",
        json={"email": SA_EMAIL, "senha": SA_PWD, "totp_code": code},
        timeout=30,
    )
    return r.json().get("access_token") if r.status_code == 200 else None


@pytest.fixture(scope="module")
def admin_token():
    t = _login(ADMIN_EMAIL, ADMIN_PWD)
    if not t:
        pytest.skip("admin login failed")
    return t


@pytest.fixture(scope="module")
def operador_token():
    t = _login(OPERADOR_EMAIL, OPERADOR_PWD)
    if not t:
        pytest.skip("operador login failed")
    return t


@pytest.fixture(scope="module")
def sa_token():
    t = _login_sa()
    if not t:
        pytest.skip("super admin login failed")
    return t


def H(t):
    return {"Authorization": f"Bearer {t}"}


# --------- Billing / Plans ---------
class TestPlans:
    def test_list_plans_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/billing/plans", timeout=20)
        assert r.status_code == 200
        data = r.json()
        plans = data["plans"]
        ids = {p["id"]: p for p in plans}
        assert {"starter", "pro", "enterprise"}.issubset(ids.keys())
        assert ids["starter"]["amount"] == 99.00
        assert ids["pro"]["amount"] == 299.00
        assert ids["enterprise"]["amount"] == 799.00


class TestStripeCheckout:
    def test_create_checkout_pro(self, admin_token):
        body = {"plano": "pro", "origin_url": "https://health-desk-8.preview.emergentagent.com"}
        r = requests.post(f"{BASE_URL}/api/billing/checkout", json=body, headers=H(admin_token), timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and "session_id" in data
        assert "checkout.stripe.com" in data["url"]
        # Persist session_id for status check
        TestStripeCheckout.session_id = data["session_id"]

    def test_checkout_status_pending(self, admin_token):
        sid = getattr(TestStripeCheckout, "session_id", None)
        if not sid:
            pytest.skip("no session id from previous test")
        r = requests.get(f"{BASE_URL}/api/billing/checkout/status/{sid}", headers=H(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        # Stripe newly-created sessions: payment_status = 'unpaid' or 'no_payment_required',
        # status = 'open'. Locally before paid we set 'pending'.
        assert data["session_id"] == sid
        assert data["payment_status"] in ("pending", "unpaid", "no_payment_required", "open", "expired", "paid")
        assert "plano" in data

    def test_checkout_invalid_plan(self, admin_token):
        body = {"plano": "ouro", "origin_url": "https://health-desk-8.preview.emergentagent.com"}
        r = requests.post(f"{BASE_URL}/api/billing/checkout", json=body, headers=H(admin_token), timeout=30)
        assert r.status_code == 400


# --------- Web Push (VAPID) ---------
class TestPush:
    def test_public_key_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/integrations/push/public-key", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "publicKey" in data
        assert data.get("configured") is True
        assert len(data["publicKey"]) > 20

    def test_subscribe_persists(self, operador_token):
        endpoint = f"https://fake-push-endpoint.example.com/test-{int(time.time())}"
        body = {
            "endpoint": endpoint,
            "keys": {"p256dh": "BNNL...fake_key", "auth": "fake_auth"},
        }
        r = requests.post(
            f"{BASE_URL}/api/integrations/push/subscribe",
            json=body, headers=H(operador_token), timeout=20,
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # Second call (upsert) must succeed too
        r2 = requests.post(
            f"{BASE_URL}/api/integrations/push/subscribe",
            json=body, headers=H(operador_token), timeout=20,
        )
        assert r2.status_code == 200


# --------- Google OAuth ---------
class TestGoogleOAuth:
    def test_status_operador(self, operador_token):
        r = requests.get(f"{BASE_URL}/api/integrations/google/status", headers=H(operador_token), timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("configured") is True
        assert data.get("connected") is False

    def test_authorize_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/integrations/google/authorize", headers=H(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and "redirect_uri" in data
        # Validate URL structure
        assert "accounts.google.com" in data["url"]
        # Should use BACKEND_PUBLIC_URL
        assert "health-desk-8.preview.emergentagent.com/api/integrations/google/callback" in data["redirect_uri"]
        assert "state=" in data["url"]

    def test_authorize_operador_forbidden(self, operador_token):
        r = requests.get(f"{BASE_URL}/api/integrations/google/authorize", headers=H(operador_token), timeout=20)
        assert r.status_code in (401, 403)


# --------- Conversas / Evolution real call ---------
class TestEnviarMensagemEvolution:
    def test_send_returns_structured_failure(self, admin_token):
        # Instance "clinica_moreira" likely does not exist on real server -> ok=false expected
        body = {"mensagem": "Mensagem de teste automatizada"}
        r = requests.post(
            f"{BASE_URL}/api/conversas/11912345678/enviar",
            json=body, headers=H(admin_token), timeout=60,
        )
        # Either 200 with ok=false or 400/502; primary contract: 200 with ok flag
        assert r.status_code == 200, r.text
        data = r.json()
        assert "ok" in data
        # Expect ok=false because the demo Evolution instance doesn't exist
        # (Acceptable variations: ok=true if the real instance happens to exist)
        assert isinstance(data["ok"], bool)
        if data["ok"] is False:
            assert "error" in data or "message" in data


# --------- Super-admin health ---------
class TestAdminHealth:
    def test_health_lists_services(self, sa_token):
        r = requests.get(f"{BASE_URL}/api/admin/health", headers=H(sa_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        names = {s["nome"] for s in data["services"]}
        for required in ["MongoDB", "Evolution API", "n8n", "Google Calendar OAuth", "Stripe", "Web Push (VAPID)"]:
            assert required in names, f"Missing service: {required}"


# --------- Stripe webhook tolerance ---------
class TestStripeWebhook:
    def test_webhook_invalid_signature_no_crash(self):
        r = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            data=b'{"id":"evt_test"}',
            headers={"Stripe-Signature": "invalid", "Content-Type": "application/json"},
            timeout=30,
        )
        # Must NOT 500 (no retry). Return 200 with ok=false.
        assert r.status_code == 200, f"Expected 200 with ok=false, got {r.status_code}: {r.text}"
        data = r.json()
        # Either ignored (no session_id) or ok=false on parse
        assert ("ok" in data)
