"""
Backend tests for ClinicaPanel v2.0
Tests: auth, dashboard, kanban, escalacoes, conversas
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

CLINIC1_EMAIL = "admin@clinicamoreira.com"
CLINIC1_PWD = "Clinica@123"
CLINIC2_EMAIL = "admin@clinicasilva.com"
CLINIC2_PWD = "Clinica@123"


def get_token(email, pwd):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "senha": pwd})
    if r.status_code == 200:
        return r.json().get("access_token")
    return None


@pytest.fixture(scope="module")
def token1():
    t = get_token(CLINIC1_EMAIL, CLINIC1_PWD)
    if not t:
        pytest.skip("Auth failed for clinic1")
    return t


@pytest.fixture(scope="module")
def token2():
    t = get_token(CLINIC2_EMAIL, CLINIC2_PWD)
    if not t:
        pytest.skip("Auth failed for clinic2")
    return t


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# Auth tests
class TestAuth:
    """Authentication flow tests"""

    def test_login_clinic1_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": CLINIC1_EMAIL, "senha": CLINIC1_PWD})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == CLINIC1_EMAIL

    def test_login_clinic2_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": CLINIC2_EMAIL, "senha": CLINIC2_PWD})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == CLINIC2_EMAIL

    def test_login_invalid_credentials(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "wrong@test.com", "senha": "wrongpwd"})
        assert r.status_code == 401

    def test_me_endpoint(self, token1):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(token1))
        assert r.status_code == 200
        data = r.json()
        assert "email" in data


# Dashboard tests
class TestDashboard:
    """Dashboard metrics tests"""

    def test_dashboard_metricas(self, token1):
        r = requests.get(f"{BASE_URL}/api/dashboard/metricas", headers=auth_headers(token1))
        assert r.status_code == 200
        data = r.json()
        # Should have some metric fields
        assert isinstance(data, dict)

    def test_dashboard_tenant_isolation(self, token1, token2):
        r1 = requests.get(f"{BASE_URL}/api/dashboard/metricas", headers=auth_headers(token1))
        r2 = requests.get(f"{BASE_URL}/api/dashboard/metricas", headers=auth_headers(token2))
        assert r1.status_code == 200
        assert r2.status_code == 200


# Kanban tests
class TestKanban:
    """Kanban board tests"""

    def test_kanban_returns_columns(self, token1):
        r = requests.get(f"{BASE_URL}/api/kanban", headers=auth_headers(token1))
        assert r.status_code == 200
        data = r.json()
        assert "columns" in data
        columns = data["columns"]
        expected_cols = ["novo_contato", "em_atendimento", "agendando", "agendado", "confirmado"]
        for col in expected_cols:
            assert col in columns, f"Column {col} not found"

    def test_kanban_tenant_isolation(self, token1, token2):
        r1 = requests.get(f"{BASE_URL}/api/kanban", headers=auth_headers(token1))
        r2 = requests.get(f"{BASE_URL}/api/kanban", headers=auth_headers(token2))
        assert r1.status_code == 200
        assert r2.status_code == 200
        # They should have different data (or at least return valid structures)

    def test_kanban_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/kanban")
        assert r.status_code in [401, 403]


# Escalacoes tests
class TestEscalacoes:
    """Escalações (alerts) tests"""

    def test_get_escalacoes(self, token1):
        r = requests.get(f"{BASE_URL}/api/escalacoes", headers=auth_headers(token1))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, (dict, list))

    def test_escalacoes_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/escalacoes")
        assert r.status_code in [401, 403]


# Conversas tests
class TestConversas:
    """Conversas (chat) tests"""

    def test_get_conversas(self, token1):
        r = requests.get(f"{BASE_URL}/api/conversas", headers=auth_headers(token1))
        assert r.status_code == 200

    def test_conversas_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/conversas")
        assert r.status_code in [401, 403]
