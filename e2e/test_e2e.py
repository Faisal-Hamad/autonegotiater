"""End-to-end scenarios in a real browser (TC-E2E)."""
import re

from playwright.sync_api import expect

PRODUCT_A, PRODUCT_B = 1, 2   # seeded: Seller A (floor below budget) and Seller B (floor above budget)


def test_wrong_password_shows_error(page, base_url):
    page.goto(f"{base_url}/login")
    page.get_by_label("Email").fill("buyer@test.local")
    page.get_by_label("Password").fill("wrong-password")
    page.get_by_role("button", name="Sign in").click()
    expect(page.get_by_text("Email or password is incorrect.")).to_be_visible()


def test_private_pages_need_sign_in(page, base_url):
    page.goto(f"{base_url}/dashboard/buyer")
    expect(page.get_by_text("Sign in required")).to_be_visible()


def test_buyer_cannot_open_admin(sign_in):
    page = sign_in("buyer")
    page.goto("/dashboard/admin")
    expect(page.get_by_text("does not have this role")).to_be_visible()


def test_buy_now_without_negotiation(sign_in):
    page = sign_in("buyer")
    page.goto(f"/products/{PRODUCT_A}")
    page.get_by_role("button", name=re.compile("Buy now")).click()
    page.get_by_role("button", name="Confirm purchase").click()
    page.wait_for_url("**/dashboard/buyer/deals")
    expect(page.get_by_text("Direct purchase · No negotiation").first).to_be_visible()


def test_semi_automated_negotiation_with_seller_decision(sign_in):
    buyer = sign_in("buyer")
    buyer.goto(f"/products/{PRODUCT_A}")
    buyer.get_by_role("radio", name=re.compile("Semi-automated")).check()
    buyer.get_by_role("button", name="Start Multi-Seller Negotiation").click()
    buyer.wait_for_url(re.compile(r"/products/\d+/competitive"))
    # The Buyer Agent reaches its maximum price; Seller B must decide.
    expect(buyer.get_by_text(re.compile("Waiting for Seller B"))).to_be_visible(timeout=30000)

    seller = sign_in("seller_b")
    seller.goto("/notifications")
    expect(seller.get_by_text(re.compile("reached their final offer")).first).to_be_visible()
    seller.get_by_role("link", name="Open").first.click()
    seller.get_by_role("button", name=re.compile("^Accept")).click()
    expect(seller.get_by_text(re.compile("Your decision is needed"))).to_have_count(0, timeout=10000)

    # Back to the buyer: both offers can now be compared and approved.
    expect(buyer.get_by_text(re.compile("eligible Agreements"))).to_be_visible(timeout=15000)
    buyer.get_by_role("radio", name="Select Seller B").check()
    buyer.get_by_role("button", name="Approve Selected Offer").click()
    buyer.get_by_role("button", name="Confirm Agreement").click()
    expect(buyer.get_by_text(re.compile("Recorded Agreement: Seller B"))).to_be_visible(timeout=10000)


def test_admin_platform_report(sign_in):
    page = sign_in("admin")
    page.goto("/dashboard/admin/reports")
    expect(page.get_by_text("Success rate", exact=True)).to_be_visible()
    with page.expect_download() as download:
        page.get_by_role("button", name="Download CSV").click()
    assert download.value.suggested_filename.endswith(".csv")
    page.get_by_role("radio", name=re.compile("Seller report")).click()
    page.get_by_role("button", name=re.compile("Seller A")).click()
    expect(page.get_by_text(re.compile("Preview and download"))).to_be_visible()


def test_change_password(sign_in):
    page = sign_in("buyer2")
    page.goto("/profile")
    form = page.get_by_role("form", name="Change password")
    form.get_by_label("Current password").fill("Test-Password-123")
    form.get_by_label("New password", exact=True).fill("Another-Password-456")
    form.get_by_label("Confirm new password").fill("Another-Password-456")
    form.get_by_role("button", name="Change password").click()
    expect(page.get_by_text("Your password was changed.")).to_be_visible()
