#!/usr/bin/env python3
"""Recreate missing live stores from persist/shops.json using admin forms.

Works on the current Render build, which has no persist API.
Stores are put back whenever they vanish. Only an admin delete/remove/suspend
in the app should take a shop off Merchants.
"""
import json
import os
import re
import subprocess
import time
from pathlib import Path

BASE = (os.environ.get("HARBOR_PERSIST_LIVE_URL") or "https://tikitok-shop.onrender.com").rstrip("/")
COOKIE = "/tmp/heal-live-cookies.txt"
ROOT = Path(os.environ.get("HARBOR_PERSIST_OUT") or Path.cwd())
Path(COOKIE).unlink(missing_ok=True)

DEMO_SLUGS = {
    "atlas-fitness",
    "brightbyte-electronics",
    "cedar-co-home",
    "lumen-beauty",
    "northline-outfitters",
    "willow-baby",
}


def load_stores():
    for rel in ("persist/shops.json", "prisma/recovered-stores.json"):
        path = ROOT / rel
        if not path.exists() and (ROOT / "_harbor_src" / rel).exists():
            path = ROOT / "_harbor_src" / rel
        if not path.exists():
            continue
        data = json.loads(path.read_text())
        stores = data.get("stores") or []
        if stores:
            return stores
    raise SystemExit("no persist/shops.json or recovered-stores.json")


def curl(args, out, retries=4):
    last = None
    for attempt in range(retries):
        try:
            subprocess.check_call(
                ["curl", "-sS", "-m", "90", "-c", COOKIE, "-b", COOKIE, *args, "-o", out]
            )
            return Path(out).read_text(errors="replace")
        except subprocess.CalledProcessError as error:
            last = error
            time.sleep(8 * (attempt + 1))
    raise last


def wake():
    for attempt in range(8):
        try:
            subprocess.check_call(
                ["curl", "-sS", "-m", "60", "-o", "/tmp/heal-wake.html", f"{BASE}/welcome"]
            )
            return
        except subprocess.CalledProcessError:
            time.sleep(15)
    print("wake still pending; continuing")


def find_action(html, needle):
    for match in re.finditer(r'name="(\$ACTION_ID_[^"]+)"', html):
        window = html[max(0, match.start() - 800) : match.end() + 800]
        if needle in window:
            return match.group(1)
    ids = re.findall(r'name="(\$ACTION_ID_[^"]+)"', html)
    if ids and needle == "password":
        return ids[0]
    raise SystemExit(f"no ACTION_ID near {needle!r}")


wake()
html = curl([f"{BASE}/login/admin"], "/tmp/heal-login.html")
curl(
    [
        "-X",
        "POST",
        f"{BASE}/login/admin",
        "-F",
        f"{find_action(html, 'password')}=",
        "-F",
        "email=oscar.d@example.net",
        "-F",
        "password=HarborAdmin!2026",
    ],
    "/tmp/heal-login-post.html",
)
merchants = curl(["-L", f"{BASE}/merchants"], "/tmp/heal-mer.html")
if "All merchants" not in merchants and "Merchants" not in merchants:
    raise SystemExit("admin login failed")

wanted = []
for store in load_stores():
    name = store.get("name") or ""
    slug = store.get("slug") or ""
    email = (store.get("email") or "").lower()
    if not name or not slug or not email:
        continue
    if slug in DEMO_SLUGS:
        continue
    wanted.append(store)

missing = [store for store in wanted if store["name"] not in merchants and store["slug"] not in merchants]
print("heal missing", [store["name"] for store in missing])
if not missing:
    print("heal ok, all saved stores already on live")
    raise SystemExit(0)

apps = curl(["-L", f"{BASE}/merchants/applications"], "/tmp/heal-apps.html")
create_action = find_action(apps, "Business name")
for store in missing:
    email = (store.get("email") or "").lower()
    if email and email in apps:
        print("app exists", store["name"])
        continue
    print("create", store["name"])
    apps = curl(
        [
            "-L",
            "-X",
            "POST",
            f"{BASE}/merchants/applications",
            "-F",
            f"{create_action}=",
            "-F",
            f"businessName={store['name']}",
            "-F",
            f"contactName={(store.get('users') or [{}])[0].get('name') or store['name']}",
            "-F",
            f"email={email}",
            "-F",
            f"phone={store.get('phone') or ''}",
            "-F",
            f"country={store.get('country') or 'Pakistan'}",
            "-F",
            "category=Hot Selling Items",
            "-F",
            "notes=Automatic persist heal",
        ],
        "/tmp/heal-create.html",
    )
    create_action = find_action(apps, "Business name")

apps = curl(["-L", f"{BASE}/merchants/applications"], "/tmp/heal-apps2.html")
review_action = find_action(apps, "Review note")
blocks = re.split(r"<tr", apps)
for store in missing:
    email = (store.get("email") or "").lower()
    app_id = None
    for block in blocks:
        if email in block and 'name="id"' in block and "APPROVED" in block:
            match = re.search(r'name="id" value="([^"]+)"', block)
            if match:
                app_id = match.group(1)
                break
    if not app_id:
        print("no pending id", store["name"])
        continue
    print("approve", store["name"], app_id)
    curl(
        [
            "-L",
            "-X",
            "POST",
            f"{BASE}/merchants/applications",
            "-F",
            f"{review_action}=",
            "-F",
            f"id={app_id}",
            "-F",
            "reviewNote=Automatic persist heal",
            "-F",
            "decision=APPROVED",
        ],
        "/tmp/heal-approve.html",
    )

merchants = curl(["-L", f"{BASE}/merchants"], "/tmp/heal-mer2.html")
ids = sorted(set(re.findall(r"/merchants/(cmu[a-z0-9]+)", merchants)))
for mid in ids:
    page = curl(["-L", f"{BASE}/merchants/{mid}"], f"/tmp/heal-m-{mid}.html")
    store = next((item for item in missing if (item.get("email") or "").lower() in page), None)
    if not store:
        continue
    try:
        user_action = find_action(page, "Create store login")
    except SystemExit:
        continue
    email = (store.get("email") or "").lower()
    name = (store.get("users") or [{}])[0].get("name") or store["name"]
    print("create login", store["name"], email)
    curl(
        [
            "-L",
            "-X",
            "POST",
            f"{BASE}/merchants/{mid}",
            "-F",
            f"{user_action}=",
            "-F",
            f"merchantId={mid}",
            "-F",
            f"name={name}",
            "-F",
            f"email={email}",
            "-F",
            "password=HarborMerchant!2026",
        ],
        f"/tmp/heal-user-{mid}.html",
    )

final = curl(["-L", f"{BASE}/merchants"], "/tmp/heal-mer-final.html")
print("FINAL", [(store["name"], store["name"] in final) for store in wanted])
missing_after = [store["name"] for store in wanted if store["name"] not in final]
if missing_after:
    raise SystemExit(f"stores still missing after heal: {missing_after}")
