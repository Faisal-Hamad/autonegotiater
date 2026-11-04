"""Authentication and access control (TC-AUTH)."""
from fastapi.testclient import TestClient

from app.main import app

from tests.api.conftest import ORIGIN
from tests.seed_data import PASSWORD


def test_register_rejects_short_password(app_client, data):
    r = app_client.post("/auth/register", json={"name": "New User", "email": "new@test.local",
                                                 "password": "short", "role": "buyer"})
    assert r.status_code == 400


def test_register_rejects_admin_role(app_client, data):
    r = app_client.post("/auth/register", json={"name": "New User", "email": "new@test.local",
                                                 "password": "A-long-password-1", "role": "admin"})
    assert r.status_code == 400


def test_register_and_session_cookie(app_client, data):
    r = app_client.post("/auth/register", json={"name": "New Buyer", "email": "New@Test.local",
                                                 "password": "A-long-password-1", "role": "buyer"})
    assert r.status_code == 200
    assert r.json()["email"] == "new@test.local"
    cookie = r.headers["set-cookie"]
    assert "autoneg_session=" in cookie and "HttpOnly" in cookie
    assert app_client.get("/auth/me").json()["role"] == "buyer"


def test_register_duplicate_email(app_client, data):
    r = app_client.post("/auth/register", json={"name": "Copy", "email": "buyer@test.local",
                                                 "password": "A-long-password-1", "role": "buyer"})
    assert r.status_code == 400


def test_login_wrong_password(app_client, data):
    r = app_client.post("/auth/login", json={"email": "buyer@test.local", "password": "wrong-password"})
    assert r.status_code == 401


def test_login_blocks_old_public_demo_password(app_client, data):
    r = app_client.post("/auth/login", json={"email": "buyer@test.local", "password": "Demo@1234"})
    assert r.status_code == 403


def test_login_and_logout(app_client, data):
    assert app_client.post("/auth/login", json={"email": "buyer@test.local", "password": PASSWORD}).status_code == 200
    assert app_client.get("/auth/me").status_code == 200
    assert app_client.post("/auth/logout").status_code == 200
    assert app_client.get("/auth/me").status_code == 401


def test_post_without_allowed_origin_is_rejected(data):
    with TestClient(app) as client:
        r = client.post("/auth/login", json={"email": "buyer@test.local", "password": PASSWORD},
                        headers={"Origin": "https://evil.example"})
        assert r.status_code == 403


def test_private_endpoints_need_sign_in(app_client, data):
    for path in ["/integration/workspace", "/workspace/bootstrap", "/dashboard/admin"]:
        assert app_client.get(path).status_code == 401, path


def test_role_checks(data, login):
    buyer = login("buyer")
    assert buyer.get("/dashboard/admin").status_code == 403
    assert buyer.get("/dashboard/seller").status_code == 403
    assert login("admin").get("/dashboard/admin").status_code == 200


def test_change_password(data, login):
    first = login("buyer")
    second = login("buyer")
    r = first.post("/auth/password", json={"currentPassword": "wrong", "newPassword": "A-new-password-99"})
    assert r.status_code == 400
    r = first.post("/auth/password", json={"currentPassword": PASSWORD, "newPassword": "short"})
    assert r.status_code == 422
    r = first.post("/auth/password", json={"currentPassword": PASSWORD, "newPassword": "A-new-password-99"})
    assert r.status_code == 200
    assert first.get("/auth/me").status_code == 200       # the current session stays signed in
    assert second.get("/auth/me").status_code == 401      # other sessions are signed out
    with TestClient(app, headers=ORIGIN) as client:
        assert client.post("/auth/login", json={"email": "buyer@test.local", "password": PASSWORD}).status_code == 401
        assert client.post("/auth/login", json={"email": "buyer@test.local",
                                                "password": "A-new-password-99"}).status_code == 200


def test_suspended_user_is_signed_out(data, login):
    buyer = login("buyer")
    admin = login("admin")
    r = admin.post("/integration/changes", json={"kind": "account_status", "reference": data["users"]["buyer"],
                                                 "data": {"active": False}})
    assert r.status_code == 200
    assert buyer.get("/auth/me").status_code == 401
    with TestClient(app, headers=ORIGIN) as client:
        assert client.post("/auth/login", json={"email": "buyer@test.local", "password": PASSWORD}).status_code == 401


def test_only_admin_can_suspend(data, login):
    r = login("buyer").post("/integration/changes", json={"kind": "account_status",
                                                          "reference": data["users"]["buyer2"], "data": {"active": False}})
    assert r.status_code == 403


def test_change_email(data, login):
    buyer = login("buyer")
    assert buyer.post("/auth/email", json={"currentPassword": "wrong", "newEmail": "new@test.local"}).status_code == 400
    assert buyer.post("/auth/email", json={"currentPassword": PASSWORD, "newEmail": "seller_a@test.local"}).status_code == 400
    assert buyer.post("/auth/email", json={"currentPassword": PASSWORD, "newEmail": "not-an-email"}).status_code == 400
    r = buyer.post("/auth/email", json={"currentPassword": PASSWORD, "newEmail": "New.Buyer@Test.local"})
    assert r.status_code == 200 and r.json()["email"] == "new.buyer@test.local"
    assert buyer.get("/auth/me").json()["email"] == "new.buyer@test.local"
    with TestClient(app, headers=ORIGIN) as client:
        assert client.post("/auth/login", json={"email": "buyer@test.local", "password": PASSWORD}).status_code == 401
        assert client.post("/auth/login", json={"email": "new.buyer@test.local", "password": PASSWORD}).status_code == 200


def test_profile_update_cannot_change_email_without_password(data, login):
    buyer = login("buyer")
    uid = data["users"]["buyer"]
    r = buyer.put(f"/workspace/users/{uid}", json={"name": "Renamed Buyer", "email": "other@test.local"})
    assert r.status_code == 400
    r = buyer.put(f"/workspace/users/{uid}", json={"name": "Renamed Buyer", "email": "buyer@test.local"})
    assert r.status_code == 200
    assert buyer.get("/auth/me").json()["name"] == "Renamed Buyer"
