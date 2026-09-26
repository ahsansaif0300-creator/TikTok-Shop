#!/usr/bin/env python3
"""Recreate missing live stores and restore recovered balances / identity.

Works on the current Render build, which has no persist API.
Stores, funds, and identity stay until an admin delete/remove/suspend.
"""
import fcntl
import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path

BASE = (os.environ.get("HARBOR_PERSIST_LIVE_URL") or "https://tikitok-shop.onrender.com").rstrip("/")
RUN_DIR = Path(f"/tmp/heal-run-{os.getpid()}")
RUN_DIR.mkdir(parents=True, exist_ok=True)
COOKIE = str(RUN_DIR / "cookies.txt")
ROOT = Path(os.environ.get("HARBOR_PERSIST_OUT") or Path.cwd())


def out(name: str) -> str:
    return str(RUN_DIR / name)
CLIENT_SLUGS = {
    "ali-collections",
    "ak-shopping-store",
    "butt-store",
    "royal-lucky-store",
    "luqman-humi-store",
    "ola-here",
}
DEMO_SLUGS = {
    "atlas-fitness",
    "brightbyte-electronics",
    "cedar-co-home",
    "lumen-beauty",
    "northline-outfitters",
    "willow-baby",
}
SKIP_SLUG_PREFIXES = (
    "keep-forever-store",
)


def skip_store(slug, email=""):
    slug = (slug or "").strip()
    email = (email or "").strip().lower()
    if slug in DEMO_SLUGS:
        return True
    if any(slug.startswith(prefix) or slug == prefix.rstrip("-") for prefix in SKIP_SLUG_PREFIXES):
        return True
    return False


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
                ["curl", "-sS", "-m", "60", "-o", out("wake.html"), f"{BASE}/welcome"]
            )
            return
        except subprocess.CalledProcessError:
            time.sleep(15)
    print("wake still pending; continuing")


def find_action(html, needle, required=True):
    for match in re.finditer(r'name="(\$ACTION_ID_[^"]+)"', html):
        window = html[max(0, match.start() - 1500) : match.end() + 1500]
        if needle in window:
            return match.group(1)
    ids = re.findall(r'name="(\$ACTION_ID_[^"]+)"', html)
    if ids and needle == "password":
        return ids[0]
    if required:
        raise SystemExit(f"no ACTION_ID near {needle!r}")
    return None


def parse_selected_available(html):
    """Read only the selected store form, never the first list card."""
    match = re.search(
        r"Available(?:<!-- -->|\s)*\$([0-9,]+\.[0-9]{2})(?:<!-- -->|\s)* · Pending",
        html,
    )
    if not match:
        return None
    return float(match.group(1).replace(",", ""))


def login():
    Path(COOKIE).unlink(missing_ok=True)
    wake()
    html = curl([f"{BASE}/login/admin"], out("login.html"))
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
        out("login-post.html"),
    )
    merchants = curl(["-L", f"{BASE}/merchants"], out("mer.html"))
    if "All merchants" not in merchants and "Merchants" not in merchants:
        raise SystemExit("admin login failed")
    return merchants


def seen_paths():
    paths = [
        ROOT / "persist" / "seen-stores.json",
        Path("/tmp/heal-seen-stores.json"),
    ]
    extra = os.environ.get("HARBOR_SEEN_STORES")
    if extra:
        paths.insert(0, Path(extra))
    return paths


def read_store_lists():
    rows = []
    rows.extend(load_stores())
    for path in seen_paths():
        if not path.exists():
            continue
        try:
            rows.extend((json.loads(path.read_text()).get("stores") or []))
        except json.JSONDecodeError:
            continue
    return rows


def merge_store_row(old, new):
    if not old:
        return dict(new)
    out = dict(old)
    for key, value in new.items():
        if key in ("users", "applications"):
            if not value:
                continue
            if old.get(key):
                continue
        if key == "city" and value in ("", new.get("country"), "Pakistan") and old.get("city") and old.get("city") not in ("", old.get("country"), "Pakistan"):
            continue
        if key in ("availableBalance", "pendingBalance"):
            out[key] = max(float(old.get(key) or 0), float(value or 0))
            continue
        if value in (None, "", []) and old.get(key) not in (None, "", []):
            continue
        if value not in (None, "", []):
            out[key] = value
    return out


def write_seen(stores):
    payload = {
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "stores": stores,
    }
    text = json.dumps(payload, indent=2) + "\n"
    for path in seen_paths():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    shops = ROOT / "persist" / "shops.json"
    if shops.exists() or ROOT.joinpath("persist").exists():
        shops.parent.mkdir(parents=True, exist_ok=True)
        current = {"stores": []}
        if shops.exists():
            try:
                current = json.loads(shops.read_text())
            except json.JSONDecodeError:
                current = {"stores": []}
        by_slug = {row.get("slug"): row for row in (current.get("stores") or []) if row.get("slug")}
        for row in stores:
            slug = row.get("slug")
            if not slug or skip_store(slug, row.get("email") or ""):
                continue
            by_slug[slug] = merge_store_row(by_slug.get(slug), row)
        current["stores"] = list(by_slug.values())
        current["updatedAt"] = payload["updatedAt"]
        shops.write_text(json.dumps(current) + "\n")


def parse_ops_store(page):
    name_match = re.search(r"<h1[^>]*>([^<]+)</h1>", page)
    slug_match = re.search(r"/s/([a-z0-9-]+)", page)
    email_match = re.search(r"([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})", page)
    phone_match = re.search(r">Phone</dt><dd[^>]*>([^<]+)", page)
    city_match = re.search(r">City</dt><dd[^>]*>([^<]+)", page)
    name = (name_match.group(1) if name_match else "").strip()
    slug = (slug_match.group(1) if slug_match else "").strip()
    email = (email_match.group(1) if email_match else "").strip().lower()
    phone = (phone_match.group(1) if phone_match else "").strip()
    city = (city_match.group(1) if city_match else "").strip()
    if phone in {"—", "-"}:
        phone = ""
    if not name or not slug or not email or skip_store(slug, email):
        return None
    return {
        "name": name,
        "slug": slug,
        "legalName": name,
        "email": email,
        "phone": phone,
        "country": "Pakistan" if city in {"Pakistan", "karachi", "Lahore", ""} else "",
        "city": city,
        "status": "ACTIVE",
        "availableBalance": 0,
        "pendingBalance": 0,
        "cnicNumber": "",
        "referralCodeUsed": "",
    }


def remember_live_stores(merchants_html):
    ids = sorted(set(re.findall(r"/merchants/(cmu[a-z0-9]+)", merchants_html)))
    live = []
    for mid in ids:
        page = curl(["-L", f"{BASE}/merchants/{mid}"], out(f"m-{mid}.html"))
        row = parse_ops_store(page)
        if row:
            live.append(row)
    known = {}
    for row in read_store_lists() + live:
        slug = row.get("slug")
        if not slug or skip_store(slug, row.get("email") or ""):
            continue
        known[slug] = merge_store_row(known.get(slug), row)
    remembered = list(known.values())
    write_seen(remembered)
    print("heal remembered", [row["name"] for row in remembered])
    return remembered


def wanted_stores(extra=None):
    wanted = []
    seen = {}
    for store in read_store_lists() + (extra or []):
        name = store.get("name") or ""
        slug = store.get("slug") or ""
        email = (store.get("email") or "").lower()
        if not name or not slug or not email:
            continue
        if skip_store(slug, email):
            continue
        store = dict(store)
        store["email"] = email
        seen[slug] = merge_store_row(seen.get(slug), store)
    wanted = list(seen.values())
    return wanted


def recreate_missing(missing):
    if not missing:
        print("heal ok, all saved stores already on live")
        return
    apps = curl(["-L", f"{BASE}/merchants/applications"], out("apps.html"))
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
            out("create.html"),
        )
        create_action = find_action(apps, "Business name")

    apps = curl(["-L", f"{BASE}/merchants/applications"], out("apps2.html"))
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
            out("approve.html"),
        )

    merchants = curl(["-L", f"{BASE}/merchants"], out("mer2.html"))
    ids = sorted(set(re.findall(r"/merchants/(cmu[a-z0-9]+)", merchants)))
    for mid in ids:
        page = curl(["-L", f"{BASE}/merchants/{mid}"], out(f"m-{mid}.html"))
        store = next((item for item in missing if (item.get("email") or "").lower() in page), None)
        if not store:
            continue
        user_action = find_action(page, "Create store login", required=False)
        if not user_action:
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
            out(f"user-{mid}.html"),
        )


def resolve_ids(wanted):
    merchants = curl(["-L", f"{BASE}/merchants"], out("mer-map.html"))
    ids = sorted(set(re.findall(r"/merchants/(cmu[a-z0-9]+)", merchants)))
    mapping = {}
    for mid in ids:
        page = curl(["-L", f"{BASE}/merchants/{mid}"], out(f"m-{mid}.html"))
        for store in wanted:
            email = (store.get("email") or "").lower()
            if email and email in page.lower():
                mapping[store["slug"]] = mid
    return mapping, merchants


def restore_funds(store, mid):
    want = float(store.get("availableBalance") or 0)
    if want <= 0:
        return
    page = curl(["-L", f"{BASE}/admin/funds?merchantId={mid}"], out(f"funds-{mid}.html"))
    if store["name"] not in page or f'name="merchantId" value="{mid}"' not in page:
        print("funds page not selected", store["name"])
        return
    live = parse_selected_available(page)
    if live is None:
        print("funds parse failed", store["name"])
        return
    if want <= live + 0.001:
        print("funds ok", store["name"], live)
        return
    delta = round(want - live, 2)
    action = find_action(page, 'name="amount"', required=False) or find_action(
        page, 'name="merchantId"', required=False
    )
    if not action:
        print("funds no action", store["name"])
        return
    print("add funds", store["name"], delta)
    result = curl(
        [
            "-L",
            "-X",
            "POST",
            f"{BASE}/admin/funds",
            "-F",
            f"{action}=",
            "-F",
            f"merchantId={mid}",
            "-F",
            f"amount={delta}",
            "-F",
            "note=Restore recovered store balance",
        ],
        out(f"funds-post-{mid}.html"),
    )
    after = parse_selected_available(result)
    print("funds after", store["name"], after)


def restore_identity(store, mid):
    page = curl(["-L", f"{BASE}/admin/stores/{mid}"], out(f"store-{mid}.html"))
    if "Sign in" in page and "ID number" not in page and "Registered information" not in page:
        print("identity page missing", store["name"])
        return
    action = find_action(page, "cnicNumber", required=False)
    if not action:
        print("identity no server form", store["name"])
        return
    city = store.get("city") or ""
    phone = store.get("phone") or ""
    cnic = store.get("cnicNumber") or ""
    llc = store.get("referralCodeUsed") or ""
    already = True
    if city and city not in page:
        already = False
    if phone and phone not in page:
        already = False
    if cnic and cnic not in page:
        already = False
    if llc and llc not in page:
        already = False
    if already:
        print("identity ok", store["name"])
        return
    print("save identity", store["name"], city, phone, cnic, llc)
    result = curl(
        [
            "-L",
            "-X",
            "POST",
            f"{BASE}/admin/stores/{mid}",
            "-F",
            f"{action}=",
            "-F",
            f"merchantId={mid}",
            "-F",
            f"cnicNumber={cnic}",
            "-F",
            f"city={city}",
            "-F",
            f"phone={phone}",
            "-F",
            f"llcCode={llc}",
        ],
        out(f"identity-post-{mid}.html"),
    )
    print(
        "identity after",
        store["name"],
        {
            "city": city and city in result,
            "phone": phone and phone in result,
            "cnic": cnic and cnic in result,
            "llc": llc and llc in result,
        },
    )


def restore_details(wanted):
    mapping, merchants = resolve_ids(wanted)
    print("heal ids", {store["name"]: mapping.get(store["slug"]) for store in wanted})
    for store in wanted:
        mid = mapping.get(store["slug"])
        if not mid:
            print("no live id", store["name"])
            continue
        restore_funds(store, mid)
        restore_identity(store, mid)
    return mapping, merchants


def cleanup_tmp():
    shutil.rmtree(RUN_DIR, ignore_errors=True)


def main():
    lock = open("/tmp/harbor-heal.lock", "a+")
    try:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("heal already running")
        return
    merchants = login()
    remembered = remember_live_stores(merchants)
    wanted = wanted_stores(remembered)
    missing = [store for store in wanted if store["name"] not in merchants and store["slug"] not in merchants]
    print("heal missing", [store["name"] for store in missing])
    recreate_missing(missing)
    merchants = curl(["-L", f"{BASE}/merchants"], out("mer-after.html"))
    remembered = remember_live_stores(merchants)
    wanted = wanted_stores(remembered)
    mapping, final = restore_details(wanted)
    print("FINAL", [(store["name"], store["name"] in final) for store in wanted])
    missing_after = [store["name"] for store in wanted if store["name"] not in final]
    if missing_after:
        raise SystemExit(f"stores still missing after heal: {missing_after}")
    funds_ok = True
    for store in wanted:
        mid = mapping.get(store["slug"])
        want = float(store.get("availableBalance") or 0)
        if not mid or want <= 0:
            continue
        page = curl(["-L", f"{BASE}/admin/funds?merchantId={mid}"], out(f"funds-check-{mid}.html"))
        live = parse_selected_available(page)
        print("funds check", store["name"], live, "want", want)
        if live is None or live + 0.001 < want:
            funds_ok = False
    if not funds_ok:
        raise SystemExit("recovered store balances still missing on live")
    cleanup_tmp()


if __name__ == "__main__":
    main()
