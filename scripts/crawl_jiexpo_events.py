#!/usr/bin/env python3
"""Crawl kalender event JIExpo Kemayoran (exhibition.jiexpo.com) untuk dataset
'kegiatan-mice-jakarta-2026'.

Sumber: API publik WordPress situs JIExpo (`/wp-json/wp/v2/ajde_events`, plugin
EventON) untuk daftar event + kategori, lalu tanggal & penyelenggara dari
JSON-LD schema.org/Event di halaman tiap event. robots.txt hanya melarang
/wp-admin/.

Sopan: User-Agent jujur + kontak, jeda 3 dtk ±20%, batas 400 halaman per run,
berhenti total saat 403/429.

Cache: scripts/jiexpo_events_cache.json — dikunci id post; tiap entri punya
`status` ("ok" | "no-jsonld" | "skip-lama"). Disimpan tiap 10 halaman.
Idempoten: entri berstatus "ok"/"no-jsonld" tidak diambil ulang.

Jalankan dari root repo:  python3 scripts/crawl_jiexpo_events.py
"""
from __future__ import annotations

import html
import json
import random
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://exhibition.jiexpo.com"
CACHE = Path("scripts/jiexpo_events_cache.json")
UA = "DisparDataPlatform-research/1.0 (+contact: alfidev@bumdesma-pgy.com)"
DELAY = 3.0
MAX_PAGES = 400
# Event 2026 hampir pasti diposting setelah pertengahan 2024; yang lebih lama
# ditandai skip-lama tanpa diambil halamannya.
MIN_POST_DATE = "2024-07-01"


class Blocked(Exception):
    pass


def fetch(url: str) -> tuple[str, dict]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode("utf-8", "replace"), dict(r.headers)
    except urllib.error.HTTPError as e:
        if e.code in (403, 429):
            raise Blocked(f"{e.code} pada {url}") from e
        raise


def pause() -> None:
    time.sleep(DELAY * random.uniform(0.8, 1.2))


def list_events() -> list[dict]:
    types = {t["id"]: t["name"] for t in json.loads(fetch(f"{BASE}/wp-json/wp/v2/event_type?per_page=100")[0])}
    out, page = [], 1
    while True:
        pause()
        body, headers = fetch(f"{BASE}/wp-json/wp/v2/ajde_events?per_page=100&page={page}&_fields=id,date,link,title,event_type")
        items = json.loads(body)
        out += [{
            "id": e["id"], "post_date": e["date"][:10], "link": e["link"],
            "judul": html.unescape(e["title"]["rendered"]).strip(),
            "kategori_jiexpo": ", ".join(types.get(t, str(t)) for t in e["event_type"]),
        } for e in items]
        if page >= int(headers.get("X-WP-TotalPages", "1")):
            return out
        page += 1


def parse_event_page(page: str) -> dict | None:
    for raw in re.findall(r'<script type="application/ld\+json">(.*?)</script>', page, re.S):
        try:
            d = json.loads(raw, strict=False)
        except json.JSONDecodeError:
            continue
        if isinstance(d, dict) and d.get("@type") == "Event":
            org = d.get("organizer") or []
            org = org if isinstance(org, list) else [org]
            loc = d.get("location") or {}
            loc = loc[0] if isinstance(loc, list) and loc else loc
            return {
                "mulai": d.get("startDate", ""), "selesai": d.get("endDate", ""),
                "penyelenggara": "; ".join(html.unescape(o.get("name", "")) for o in org if isinstance(o, dict)),
                "lokasi_detail": html.unescape(loc.get("name", "")) if isinstance(loc, dict) else "",
            }
    return None


def main() -> None:
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    for e in list_events():
        key = str(e["id"])
        cache.setdefault(key, {"status": "todo"}).update(e)
    for v in cache.values():
        if v["status"] == "todo" and v["post_date"] < MIN_POST_DATE:
            v["status"] = "skip-lama"
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))

    todo = [v for v in cache.values() if v["status"] == "todo"]
    print(f"{len(cache)} event terdaftar, {len(todo)} halaman perlu diambil")
    done = 0
    try:
        for v in todo[:MAX_PAGES]:
            pause()
            info = parse_event_page(fetch(v["link"])[0])
            v.update(info or {})
            v["status"] = "ok" if info else "no-jsonld"
            done += 1
            if done % 10 == 0:
                CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))
    except Blocked as b:
        print(f"BERHENTI: {b}", file=sys.stderr)
    finally:
        CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))
    print(f"diambil {done}; status: " + str({s: sum(v['status'] == s for v in cache.values()) for s in ('ok', 'no-jsonld', 'skip-lama', 'todo')}))


if __name__ == "__main__":
    main()
