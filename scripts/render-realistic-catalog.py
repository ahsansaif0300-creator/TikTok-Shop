#!/usr/bin/env python3
"""Download title-matched product photos and place them on a white studio background."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from urllib.parse import quote, urlencode

from PIL import Image
from rembg import new_session, remove

UA = "Mozilla/5.0 (compatible; TikTokShopCatalog/1.0)"
RETRIES = 3
WORKERS = 1
MIN_INTERVAL = 2.2
MIN_OK_BYTES = 18000
rate_lock = threading.Lock()
cut_lock = threading.Lock()
last_request = 0.0
SESSION = None


def seed_for(sku: str) -> int:
    digest = hashlib.sha256(sku.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 100000


def prompt_for(title: str, category: str) -> str:
    clothing = any(
        word in f"{title} {category}".lower()
        for word in (
            "clothing",
            "dress",
            "jacket",
            "shirt",
            "pant",
            "jean",
            "hoodie",
            "coat",
            "sweater",
            "legging",
            "tee",
            "polo",
            "onesie",
            "tutu",
            "sock",
        )
    )
    if clothing:
        return (
            f"overhead flat lay ecommerce photo of a single {title}, {category}, "
            "one garment only centered, pure white background, no person, no face, "
            "no mannequin, no extra accessories, catalog product shot"
        )
    return (
        f"photorealistic ecommerce catalog photo of a single {title}, {category}, "
        "one complete product centered, pure white background, studio lighting, "
        "no person, no hands, no text, no logo, no watermark"
    )


def photo_url(title: str, category: str, sku: str, attempt: int) -> str:
    query = urlencode(
        {
            "width": 768,
            "height": 768,
            "nologo": "true",
            "nofeed": "true",
            "seed": seed_for(sku) + attempt * 131,
        }
    )
    return f"https://image.pollinations.ai/prompt/{quote(prompt_for(title, category))}?{query}"


def curl_download(url: str) -> bytes:
    global last_request
    with rate_lock:
        wait = MIN_INTERVAL - (time.time() - last_request)
        if wait > 0:
            time.sleep(wait)
        last_request = time.time()
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        result = subprocess.run(
            [
                "curl",
                "-sS",
                "-L",
                "--max-time",
                "22",
                "--retry",
                "0",
                "-A",
                UA,
                "-o",
                str(tmp_path),
                "-w",
                "%{http_code}",
                url,
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        code = (result.stdout or "").strip()
        data = tmp_path.read_bytes() if tmp_path.exists() else b""
        if code == "429":
            time.sleep(6)
            raise RuntimeError("http 429")
        if result.returncode != 0 or code not in {"200", ""} or len(data) < 8000 or data[:2] != b"\xff\xd8":
            raise RuntimeError(f"curl {result.returncode} http {code} bytes {len(data)}")
        return data
    finally:
        tmp_path.unlink(missing_ok=True)


def commons_download(title: str) -> bytes:
    query = urllib.parse.urlencode(
        {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrnamespace": 6,
            "gsrlimit": 8,
            "prop": "imageinfo",
            "iiprop": "url|mime",
            "iiurlwidth": 800,
            "gsrsearch": title,
        }
    )
    req = urllib.request.Request(
        f"https://commons.wikimedia.org/w/api.php?{query}",
        headers={"User-Agent": "TikTokShop/1.0 (catalog photos)", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=12) as response:
        data = json.loads(response.read().decode("utf-8"))
    pages = list(((data.get("query") or {}).get("pages") or {}).values())
    for page in pages:
        info = (page.get("imageinfo") or [{}])[0]
        if not str(info.get("mime") or "").startswith("image/"):
            continue
        src = info.get("thumburl") or info.get("url")
        if not src:
            continue
        img_req = urllib.request.Request(src, headers={"User-Agent": "TikTokShop/1.0", "Accept": "image/*"})
        with urllib.request.urlopen(img_req, timeout=15) as img:
            raw = img.read()
        if len(raw) > 4000:
            return raw
    raise RuntimeError(f"no commons photo for {title}")


def to_white_studio(raw: bytes) -> Image.Image:
    image = Image.open(BytesIO(raw)).convert("RGB")
    width, height = image.size
    cropped = image.crop((0, 0, width, int(height * 0.90)))
    with cut_lock:
        cut = remove(cropped, session=SESSION).convert("RGBA")
    box = cut.getbbox()
    if box:
        cut = cut.crop(box)
    canvas = Image.new("RGB", (800, 800), (255, 255, 255))
    cut.thumbnail((680, 680), Image.Resampling.LANCZOS)
    canvas.paste(cut, ((800 - cut.width) // 2, (800 - cut.height) // 2), cut)
    return canvas


def already_done(dest: Path) -> bool:
    return dest.exists() and dest.stat().st_size >= MIN_OK_BYTES


def render_row(row: dict, dest_dir: Path) -> str:
    dest = dest_dir / f"{row['sku']}.jpg"
    if already_done(dest):
        return "skip"
    last_error = "unknown"
    sources = [
        lambda: curl_download(photo_url(row["title"], row["category"], row["sku"], 0)),
        lambda: curl_download(photo_url(row["title"], row["category"], row["sku"], 1)),
        lambda: commons_download(row["title"]),
    ]
    for fetch in sources:
        try:
            raw = fetch()
            studio = to_white_studio(raw)
            studio.save(dest, "JPEG", quality=88, optimize=True)
            if dest.stat().st_size < 6000:
                raise RuntimeError("jpeg too small")
            return "ok"
        except Exception as error:  # noqa: BLE001
            last_error = str(error)
            time.sleep(1.6)
    return f"fail:{last_error[:140]}"


def main() -> int:
    global SESSION
    if len(sys.argv) != 3:
        print("usage: render-realistic-catalog.py catalog-index.json dest-dir", flush=True)
        return 2
    rows = json.loads(Path(sys.argv[1]).read_text())
    dest_dir = Path(sys.argv[2])
    dest_dir.mkdir(parents=True, exist_ok=True)
    SESSION = new_session("u2netp")
    pending = [row for row in rows if not already_done(dest_dir / f"{row['sku']}.jpg")]
    print(f"Rendering {len(pending)}/{len(rows)} product photos onto white backgrounds…", flush=True)
    ok = len(rows) - len(pending)
    failed = 0
    done = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(render_row, row, dest_dir): row["sku"] for row in pending}
        for future in as_completed(futures):
            sku = futures[future]
            status = future.result()
            done += 1
            if status in {"ok", "skip"}:
                ok += 1
            else:
                failed += 1
                print(f"  fail {sku} {status}", flush=True)
            if done % 10 == 0 or done == len(pending):
                print(f"  {done}/{len(pending)} processed, {ok} ready, {failed} failed", flush=True)
    print(f"Wrote {ok}/{len(rows)} catalog photos ({failed} failed)", flush=True)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
