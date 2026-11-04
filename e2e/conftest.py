"""Browser (end-to-end) tests with Playwright.

They need the whole system running with the test accounts from
backend/tests/seed_data.py, and BASE_URL pointing at the website,
for example http://127.0.0.1:3000. See docs/TESTING.md.
"""
import os

import pytest

BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:3000")
PASSWORD = "Test-Password-123"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture()
def sign_in(browser):
    """Open a separate browser context signed in as a test account."""
    contexts = []

    def _sign_in(account):
        context = browser.new_context(base_url=BASE_URL, viewport={"width": 1440, "height": 900}, accept_downloads=True)
        contexts.append(context)
        page = context.new_page()
        page.goto("/login")
        page.get_by_label("Email").fill(f"{account}@test.local")
        page.get_by_label("Password").fill(PASSWORD)
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_url("**/dashboard/**")
        return page

    yield _sign_in
    for context in contexts:
        context.close()
