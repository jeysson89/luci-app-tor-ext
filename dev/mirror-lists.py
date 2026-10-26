# -*- coding: utf-8 -*-
"""
Mirror the itdoginfo/allow-domains lists (the ones podkop uses for community
routing) into this repository and generate:

  lists/*.lst                     fixed lists (domains / IPv4 subnets)
  lists/README.md                 attribution + description
  files/usr/share/tor-ext/catalog.json   metadata for the LuCI UI
  files/usr/share/tor-ext/list-files.tab  TSV id/file/kind/subnets for ash

Run:  python dev/mirror-lists.py
"""
import io
import json
import os
import urllib.request

BASE = "https://raw.githubusercontent.com/itdoginfo/allow-domains/main/"

# id -> (source path in allow-domains, human title, UI group, description)
DOMAINS = [
    ("russia_inside", "Russia/inside-raw.lst", u"Сборный список «Россия»",
     u"Россия", u"https, twitter, meta, новости и прочие сайты, которым нужен обход блокировок"),
    ("youtube", "Services/youtube.lst", u"YouTube", u"Сервисы", u"Видео YouTube и CDN googlevideo"),
    ("meta", "Services/meta.lst", u"Meta (Instagram, Facebook, WhatsApp)", u"Сервисы", u"Соцсети Meta"),
    ("twitter", "Services/twitter.lst", u"Twitter (X)", u"Сервисы", u"Твиттер и CDN twimg"),
    ("discord", "Services/discord.lst", u"Discord", u"Сервисы", u"Голосовые и текстовые чаты Discord"),
    ("telegram", "Services/telegram.lst", u"Telegram", u"Сервисы", u"Веб-версия Telegram"),
    ("google_ai", "Services/google_ai.lst", u"Google AI (Gemini)", u"Сервисы", u"Gemini и другие AI-сервисы Google"),
    ("google_play", "Services/google_play.lst", u"Google Play", u"Сервисы", u"Магазин приложений Google"),
    ("google_meet", "Services/google_meet.lst", u"Google Meet", u"Сервисы", u"Видеоконференции Google"),
    ("hdrezka", "Services/hdrezka.lst", u"HDRezka", u"Сервисы", u"Онлайн-кинотеатр HDRezka"),
    ("tiktok", "Services/tiktok.lst", u"TikTok", u"Сервисы", u"TikTok и CDN"),
    ("roblox", "Services/roblox.lst", u"Roblox", u"Сервисы", u"Игровая платформа Roblox"),
    ("cloudflare", "Services/cloudflare.lst", u"Cloudflare", u"Сервисы", u"Домены Cloudflare"),
    ("cloudfront", "Services/cloudfront.lst", u"Cloudfront (Amazon)", u"Сервисы", u"Домены Amazon Cloudfront"),
    ("digitalocean", "Services/digitalocean.lst", u"DigitalOcean", u"Сервисы", u"Домены DigitalOcean"),
    ("hetzner", "Services/hetzner.lst", u"Hetzner", u"Сервисы", u"Домены Hetzner"),
    ("ovh", "Services/ovh.lst", u"OVH", u"Сервисы", u"Домены OVH"),
    ("geoblock", "Categories/geoblock.lst", u"Сайты с геоблокировкой", u"Категории",
     u"Сервисы, которые сами блокируют российские IP"),
    ("block", "Categories/block.lst", u"Заблокированное в РФ", u"Категории",
     u"Сайты, заблокированные в России"),
    ("news", "Categories/news.lst", u"Новости (медиа)", u"Категории",
     u"Заблокированные или замедленные новостные сайты"),
    ("anime", "Categories/anime.lst", u"Аниме-сервисы", u"Категории", u"Заблокированные аниме-сервисы"),
    ("hodca", "Categories/hodca.lst", u"Прочее (сообщество)", u"Категории", u"Прочие полезные домены"),
    ("porn", "Categories/porn.lst", u"Порно-сервисы", u"Категории", u"Заблокированные в РФ"),
]

# id -> (source path, human title, description)
SUBNETS = [
    ("subnets-meta", "Subnets/IPv4/meta.lst", u"Meta — подсети IPv4", u"Серверы Meta"),
    ("subnets-twitter", "Subnets/IPv4/twitter.lst", u"Twitter — подсети IPv4", u"Серверы Twitter"),
    ("subnets-discord", "Subnets/IPv4/discord.lst", u"Discord — подсети IPv4", u"Серверы Discord (голос)"),
    ("subnets-telegram", "Subnets/IPv4/telegram.lst", u"Telegram — подсети IPv4", u"Серверы Telegram"),
    ("subnets-cloudflare", "Subnets/IPv4/cloudflare.lst", u"Cloudflare — подсети IPv4", u"Сети Cloudflare"),
    ("subnets-cloudfront", "Subnets/IPv4/cloudfront.lst", u"Cloudfront — подсети IPv4", u"Сети Cloudfront"),
    ("subnets-digitalocean", "Subnets/IPv4/digitalocean.lst", u"DigitalOcean — подсети IPv4", u"Сети DigitalOcean"),
    ("subnets-google_meet", "Subnets/IPv4/google_meet.lst", u"Google Meet — подсети IPv4", u"Сети Google Meet"),
    ("subnets-hetzner", "Subnets/IPv4/hetzner.lst", u"Hetzner — подсети IPv4", u"Сети Hetzner"),
    ("subnets-ovh", "Subnets/IPv4/ovh.lst", u"OVH — подсети IPv4", u"Сети OVH"),
    ("subnets-roblox", "Subnets/IPv4/roblox.lst", u"Roblox — подсети IPv4", u"Сети Roblox"),
]

# which subnet list ships together with which domain list
SUBNETS_OF = {
    "meta": "subnets-meta",
    "twitter": "subnets-twitter",
    "discord": "subnets-discord",
    "telegram": "subnets-telegram",
    "cloudflare": "subnets-cloudflare",
    "cloudfront": "subnets-cloudfront",
    "digitalocean": "subnets-digitalocean",
    "google_meet": "subnets-google_meet",
    "hetzner": "subnets-hetzner",
    "ovh": "subnets-ovh",
    "roblox": "subnets-roblox",
}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LISTS_DIR = os.path.join(ROOT, "lists")

OPENER = urllib.request.build_opener()
OPENER.addheaders = [("User-Agent", "luci-app-tor-ext-mirror")]


def fetch(path):
    url = BASE + path
    with OPENER.open(url, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def clean(text):
    out = []
    for line in text.split("\n"):
        s = line.strip()
        if not s or s.startswith("#") or s.startswith("//"):
            continue
        if " " in s or "\t" in s:
            s = s.split()[0]
        out.append(s)
    # drop duplicates keeping order
    seen = set()
    res = []
    for s in out:
        if s not in seen:
            seen.add(s)
            res.append(s)
    return res


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with io.open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)


counts = {"d": 0, "s": 0}

catalog = {
    "source": "itdoginfo/allow-domains",
    "source_url": "https://github.com/itdoginfo/allow-domains",
    "license": "MIT",
    "lists": []
}

for did, path, title, group, desc in DOMAINS:
    lines = clean(fetch(path))
    fname = did + ".lst"
    write(os.path.join(LISTS_DIR, fname), "\n".join(lines) + "\n")
    counts["d"] += len(lines)
    entry = {
        "id": did, "kind": "domains", "title": title, "group": group,
        "desc": desc, "file": fname, "count": len(lines),
    }
    if did in SUBNETS_OF:
        entry["subnets_of"] = SUBNETS_OF[did]
    catalog["lists"].append(entry)
    print("domains %-14s %4d %s" % (did, len(lines), title))

for sid, path, title, desc in SUBNETS:
    lines = clean(fetch(path))
    fname = sid + ".lst"
    write(os.path.join(LISTS_DIR, fname), "\n".join(lines) + "\n")
    counts["s"] += len(lines)
    catalog["lists"].append({
        "id": sid, "kind": "subnets", "title": title, "group": u"Подсети",
        "desc": desc, "file": fname, "count": len(lines),
    })
    print("subnets %-18s %4d %s" % (sid, len(lines), title))

# sort the catalog by group and title keeping russia first
groups = [u"Россия", u"Сервисы", u"Категории", u"Подсети"]
catalog["lists"].sort(key=lambda e: (groups.index(e["group"]), e["title"]))

write(os.path.join(LISTS_DIR, "README.md"), u"""\
# Списки для раздельного туннелирования

Зеркало списков доменов и подсетей из [itdoginfo/allow-domains](https://github.com/itdoginfo/allow-domains)
(те же списки использует [podkop](https://github.com/itdoginfo/podkop), лицензия MIT).

Приложение тянет файлы отсюда:

    https://raw.githubusercontent.com/jeysson89/luci-app-tor-ext/main/lists/<имя>.lst

Свой домен или подсеть можно добавить в самом интерфейсе (раздел
«Раздельное туннелирование» → «Свои цели»).

- `russia_inside.lst` — сборный список «Россия» (%d доменов)
- сервисы: YouTube, Meta, Twitter, Discord, Telegram и т.д. (%d доменов)
- категории: geoblock, block, news, anime, porn (%d доменов)
- подсети IPv4 отдельных платформ (%d подсетей)

Обновлять это зеркало: `python dev/mirror-lists.py`
""" % (sum(e["count"] for e in catalog["lists"] if e["id"] == "russia_inside"),
       sum(e["count"] for e in catalog["lists"] if e["group"] == u"Сервисы" and e["kind"] == "domains"),
       sum(e["count"] for e in catalog["lists"] if e["group"] == u"Категории"),
       sum(e["count"] for e in catalog["lists"] if e["kind"] == "subnets")))

write(os.path.join(LISTS_DIR, "catalog.json"), json.dumps(catalog, ensure_ascii=False, indent="\t"))

# package assets for the router
write(os.path.join(ROOT, "files", "usr", "share", "tor-ext", "catalog.json"),
      json.dumps(catalog, ensure_ascii=False, indent="\t"))

# TSV: id \t kind \t file \t subnets_file(for domains) \t group
tab = []
for e in sorted(catalog["lists"], key=lambda e: (groups.index(e["group"]), e["title"])):
    tab.append("\t".join([e["id"], e["kind"], e["file"], e.get("subnets_of", ""), e["group"]]))
write(os.path.join(ROOT, "files", "usr", "share", "tor-ext", "list-files.tab"),
      "\n".join(tab) + "\n")

print()
print("domains: %d lines total, subnets: %d" % (counts["d"], counts["s"]))
print("catalog: %d lists" % len(catalog["lists"]))
