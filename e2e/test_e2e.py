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
    # Semi-automated mode runs one round at a time: the buyer presses Next round after reading each round.
    expect(buyer.get_by_role("button", name="Run round 1 →")).to_be_visible()
    for round_number in range(1, 7):
        button = buyer.get_by_role("button", name=re.compile(r"^(Run round 1|Next round)"))
        button.click()
        expect(buyer.get_by_text(re.compile(f"Round {round_number} of 6"))).to_be_visible(timeout=15000)
    # The Buyer Agent reached its maximum price; Seller B must decide.
    expect(buyer.get_by_text(re.compile("Waiting for Seller B"))).to_be_visible(timeout=15000)

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


def test_profile_shows_account_type_and_changes_password(sign_in):
    page = sign_in("buyer2")
    page.goto("/profile")
    expect(page.get_by_label("Account type: Buyer")).to_be_visible()
    form = page.get_by_role("form", name="Change password")
    expect(form).to_be_hidden()                      # collapsed until opened
    page.get_by_text("Change password", exact=True).first.click()
    form.get_by_label("Current password").fill("Test-Password-123")
    form.get_by_label("New password", exact=True).fill("Another-Password-456")
    form.get_by_label("Confirm new password").fill("Another-Password-456")
    form.get_by_role("button", name="Change password").click()
    expect(page.get_by_text("Your password was changed.")).to_be_visible()


def test_profile_change_email(sign_in):
    page = sign_in("seller_a")
    page.goto("/profile")
    expect(page.get_by_label("Account type: Seller")).to_be_visible()
    page.get_by_text("Change email", exact=True).first.click()
    form = page.get_by_role("form", name="Change email")
    form.get_by_label("New email").fill("seller.a.new@test.local")
    form.get_by_label("Current password").fill("Test-Password-123")
    form.get_by_role("button", name="Change email").click()
    expect(page.get_by_text("Your email was changed.")).to_be_visible()
    expect(page.get_by_text("seller.a.new@test.local").first).to_be_visible()


def test_buyer_picks_listings_for_multi_seller_negotiation(sign_in):
    """Option B: choose 2 to 5 listings in the marketplace and negotiate with all of them."""
    page = sign_in("buyer")
    page.goto("/products")
    buttons = page.get_by_role("button", name="+ Multi-seller negotiation")
    expect(buttons.first).to_be_visible()
    page.get_by_role("article").filter(has_text="Samsung Galaxy S24").get_by_role("button", name="+ Multi-seller negotiation").click()
    bar = page.get_by_role("region", name="Multi-seller selection")
    expect(bar).to_contain_text("1 of 5 selected")
    expect(bar.get_by_role("button", name=re.compile("Negotiate with these"))).to_be_disabled()   # at least 2
    page.get_by_role("button", name="+ Multi-seller negotiation").first.click()
    expect(bar).to_contain_text("2 of 5 selected")
    bar.get_by_role("link", name=re.compile("Negotiate with these 2 sellers")).click()
    page.wait_for_url(re.compile(r"/products/\d+\?select="))
    expect(page.get_by_text(re.compile("You chose these 2 listings"))).to_be_visible()
    page.get_by_role("radio", name=re.compile("^Automated")).check()
    page.get_by_role("button", name="Start Multi-Seller Negotiation").click()
    expect(page.get_by_text(re.compile(r"\d eligible Agreements"))).to_be_visible(timeout=30000)
