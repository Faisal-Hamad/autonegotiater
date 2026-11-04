"""Multi-seller negotiation, semi-automated seller decision and privacy (TC-NEG)."""
import json

REQ = {"quantity": 1, "targetPrice": 3080, "maximumPrice": 3657.5, "deliveryDays": 7, "maxRounds": 6}


def start(client, product_id, mode="semi_automated", **changes):
    r = client.post("/integration/attempts", json={"productId": product_id, "requirements": {**REQ, "mode": mode, **changes},
                                                   "matchingPolicy": "model-storage-v1"})
    assert r.status_code == 200, r.text
    return r.json()["competitive"]["attempts"][-1]


def run_rounds(client, rid, rounds=8):
    for _ in range(rounds):
        r = client.post(f"/integration/attempts/{rid}", json={"action": "advance"})
        assert r.status_code == 200, r.text
    return next(a for a in r.json()["competitive"]["attempts"] if a["attemptId"] == rid)


def seller(attempt, name):
    return next(s for s in attempt["sellers"] if s["name"] == name)


def test_catalog_is_public_and_hides_seller_floor(app_client, data):
    r = app_client.get("/integration/catalog")
    assert r.status_code == 200
    assert "minimumPrice" not in json.dumps(r.json())


def test_only_buyers_start_negotiations(data, login):
    r = login("seller_a").post("/integration/attempts", json={"productId": data["products"]["seller_a"], "requirements": REQ})
    assert r.status_code == 403


def test_invalid_requirements_rejected(data, login):
    buyer = login("buyer")
    for bad in [{"targetPrice": 4000}, {"quantity": 0}, {"maxRounds": 13}, {"mode": "manual"}]:
        r = buyer.post("/integration/attempts", json={"productId": data["products"]["seller_a"],
                                                      "requirements": {**REQ, **bad}, "matchingPolicy": "model-storage-v1"})
        assert r.status_code == 400, bad


def test_buyer_offer_rises_to_maximum(data, login):
    buyer = login("buyer")
    attempt = run_rounds(buyer, start(buyer, data["products"]["seller_a"])["attemptId"])
    offers = [m["price"] for m in seller(attempt, "Seller B")["history"] if m["agent"] == "Buyer Agent"]
    assert offers[0] == REQ["targetPrice"]
    assert offers == sorted(offers) and offers[-1] == REQ["maximumPrice"]


def test_semi_automated_seller_accepts_final_offer(data, login):
    buyer, seller_b = login("buyer"), login("seller_b")
    rid = start(buyer, data["products"]["seller_a"])["attemptId"]
    attempt = run_rounds(buyer, rid)
    assert attempt["phase"] == "running"                      # waits for Seller B
    b = seller(attempt, "Seller B")
    assert b["status"] == "awaiting_seller" and b["pendingOffer"] == REQ["maximumPrice"]
    assert seller(attempt, "Seller A")["status"] == "agreed"

    workspace = seller_b.get("/integration/workspace").json()["competitive"]
    assert any("final offer" in n["text"] for n in workspace["notices"])   # the seller is notified
    listing = str(data["products"]["seller_b"])

    assert buyer.post(f"/integration/attempts/{rid}/seller-decision",
                      json={"listingId": listing, "decision": "accept"}).status_code == 403
    assert login("seller_a").post(f"/integration/attempts/{rid}/seller-decision",
                                  json={"listingId": listing, "decision": "accept"}).status_code == 403

    r = seller_b.post(f"/integration/attempts/{rid}/seller-decision", json={"listingId": listing, "decision": "accept"})
    assert r.status_code == 200
    assert seller_b.post(f"/integration/attempts/{rid}/seller-decision",
                         json={"listingId": listing, "decision": "accept"}).status_code == 409   # only once

    attempt = next(a for a in buyer.get("/integration/workspace").json()["competitive"]["attempts"] if a["attemptId"] == rid)
    assert attempt["phase"] == "review"
    assert seller(attempt, "Seller B")["agreedPrice"] == REQ["maximumPrice"]

    r = buyer.post(f"/integration/attempts/{rid}", json={"action": "approve", "sellerId": listing})
    assert r.status_code == 200, r.text
    agreement = r.json()["competitive"]["agreements"][0]
    assert agreement["unitPrice"] == REQ["maximumPrice"] and agreement["sellerId"] == data["users"]["seller_b"]


def test_semi_automated_seller_rejects_final_offer(data, login):
    buyer, seller_b = login("buyer"), login("seller_b")
    rid = start(buyer, data["products"]["seller_a"])["attemptId"]
    run_rounds(buyer, rid)
    r = seller_b.post(f"/integration/attempts/{rid}/seller-decision",
                      json={"listingId": str(data["products"]["seller_b"]), "decision": "reject"})
    assert r.status_code == 200
    attempt = next(a for a in buyer.get("/integration/workspace").json()["competitive"]["attempts"] if a["attemptId"] == rid)
    assert attempt["phase"] == "review" and seller(attempt, "Seller B")["status"] == "declined"


def test_automated_mode_needs_no_seller_decision(data, login):
    buyer = login("buyer")
    attempt = run_rounds(buyer, start(buyer, data["products"]["seller_a"], mode="automated")["attemptId"])
    assert attempt["phase"] == "review"
    assert seller(attempt, "Seller B")["status"] == "declined"
    assert seller(attempt, "Seller A")["status"] == "agreed"


def test_approval_records_deal_and_reduces_stock(data, login):
    buyer = login("buyer")
    rid = start(buyer, data["products"]["seller_a"], mode="automated")["attemptId"]
    attempt = run_rounds(buyer, rid)
    a = seller(attempt, "Seller A")
    r = buyer.post(f"/integration/attempts/{rid}", json={"action": "approve", "sellerId": a["id"]})
    assert r.status_code == 200
    assert r.json()["competitive"]["agreements"][0]["unitPrice"] == a["agreedPrice"]
    product = next(p for p in r.json()["state"]["products"] if p["id"] == data["products"]["seller_a"])
    assert product["stock_quantity"] == 4
    assert buyer.post(f"/integration/attempts/{rid}", json={"action": "cancel"}).status_code == 409


def test_other_buyer_cannot_act_on_session(data, login):
    buyer = login("buyer")
    rid = start(buyer, data["products"]["seller_a"])["attemptId"]
    assert login("buyer2").post(f"/integration/attempts/{rid}", json={"action": "advance"}).status_code == 403


def test_privacy_buyer_and_seller_views(data, login):
    buyer, seller_a = login("buyer"), login("seller_a")
    run_rounds(buyer, start(buyer, data["products"]["seller_a"])["attemptId"])
    buyer_text = json.dumps(buyer.get("/integration/workspace").json()["competitive"])
    assert "minimumPrice" not in buyer_text                   # buyer never sees a seller floor
    seller_view = seller_a.get("/integration/workspace").json()["competitive"]
    assert "maximumPrice" not in json.dumps(seller_view["sellerSessions"])   # seller never sees the buyer budget
    assert all(s["sellerAccountId"] == data["users"]["seller_a"] for s in seller_view["sellerSessions"])


def test_buyer_selected_listings_must_be_two_to_five(data, login):
    buyer = login("buyer")
    pid = data["products"]["seller_a"]
    for ids in [[pid], [pid, 2, 3, 4, 5, 6], [2, 3]]:
        r = buyer.post("/integration/attempts", json={"productId": pid, "requirements": {**REQ, "mode": "automated"},
                                                      "matchingPolicy": "buyer-selected", "productIds": ids})
        assert r.status_code in (400, 404), ids


def test_buyer_selected_different_products(data, login):
    """Option B: the buyer negotiates with listings of different models at the same time."""
    buyer = login("buyer")
    phone, samsung = data["products"]["product_1"], data["products"]["product_3"]
    r = buyer.post("/integration/attempts", json={"productId": phone, "requirements": {**REQ, "mode": "automated"},
                                                  "matchingPolicy": "buyer-selected", "productIds": [phone, samsung]})
    assert r.status_code == 200, r.text
    attempt = r.json()["competitive"]["attempts"][-1]
    assert sorted(s["productId"] for s in attempt["sellers"]) == [phone, samsung]   # Seller B's iPhone is not included
    attempt = run_rounds(buyer, attempt["attemptId"])
    agreed = [s for s in attempt["sellers"] if s["status"] == "agreed"]
    assert agreed
    choice = next(s for s in agreed if s["productId"] == samsung)
    r = buyer.post(f"/integration/attempts/{attempt['attemptId']}", json={"action": "approve", "sellerId": choice["id"]})
    assert r.status_code == 200, r.text
    assert r.json()["competitive"]["agreements"][0]["productId"] == samsung
