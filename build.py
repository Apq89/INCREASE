#!/usr/bin/env python3
"""Gera index.html (a app) a partir de src/game.html.

O src/game.html é o jogo tal como foi desenhado (sem <html>/<head>).
Este script embrulha-o num documento completo, liga o manifesto da app,
o service worker, o Supabase e o módulo de contas (cloud.js).

Uso:  python3 build.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent
game = (ROOT / "src" / "game.html").read_text(encoding="utf-8")

# Separa o cabeçalho (título, fontes, estilos) do resto (corpo e script do jogo)
style_end = game.index("</style>") + len("</style>")
head_part, body_part = game[:style_end], game[style_end:]

# O jogo arranca através do cloud.js (login primeiro), em vez de arrancar sozinho
boot_old = "window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});"
assert boot_old in body_part, "linha de arranque não encontrada em src/game.html"
body_part = body_part.replace(boot_old, "window.IncreaseBoot ? window.IncreaseBoot(start) : start({});")

# Os scripts da app têm de carregar antes do script do jogo
script_start = body_part.index("<script>")
app_scripts = """<script src="config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
<script src="cloud.js"></script>
"""
body_part = body_part[:script_start] + app_scripts + body_part[script_start:]

html = f"""<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0A0A0A">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Increase">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/icon-192.png">
{head_part}
<style>
:root{{padding-top:env(safe-area-inset-top,0px); padding-bottom:env(safe-area-inset-bottom,0px)}}
html{{background:#0A0A0A}}
body{{margin:0; font-size:14px}}
img{{max-width:100%}}
[hidden]{{display:none !important}}
</style>
</head>
<body>
{body_part}
<script>
if('serviceWorker' in navigator) window.addEventListener('load', ()=>navigator.serviceWorker.register('sw.js').catch(()=>{{}}));
</script>
</body>
</html>
"""
(ROOT / "index.html").write_text(html, encoding="utf-8")
print("index.html gerado:", len(html) // 1024, "KB")
