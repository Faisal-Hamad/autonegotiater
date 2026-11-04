"""Direct purchase without negotiation (TC-BUY)."""


def test_buy_now_creates_direct_deal(data, login):
    buyer = login("buyer")
    pid = data["products"]["seller_a"]
    r = buyer.post("/integration/buy-now", json={"productId": pid, "quantity": 2})
    assert r.status_code == 200, r.text
    state = r.json()["state"]
    deal = state["deals"][0]
    assert deal["purchaseType"] == "direct" and deal["price"] == 3850.0 and deal["quantity"] == 2
    assert next(p for p in state["products"] if p["id"] == pid)["stock_quantity"] == 3


def test_buy_now_checks_stock(data, login):
    r = login("buyer").post("/integration/buy-now", json={"productId": data["products"]["seller_b"], "quantity": 4})
    assert r.status_code == 409


def test_buy_now_is_for_buyers_only(data, login):
    r = login("seller_a").post("/integration/buy-now", json={"productId": data["products"]["seller_b"], "quantity": 1})
    assert r.status_code == 403


def test_buy_now_needs_sign_in(app_client, data):
    assert app_client.post("/integration/buy-now", json={"productId": 1, "quantity": 1}).status_code == 401


def test_seller_sees_direct_sale(data, login):
    login("buyer").post("/integration/buy-now", json={"productId": data["products"]["seller_a"], "quantity": 1})
    deals = login("seller_a").get("/integration/workspace").json()["state"]["deals"]
    assert len(deals) == 1 and deals[0]["purchaseType"] == "direct"
    assert login("seller_b").get("/integration/workspace").json()["state"]["deals"] == []
