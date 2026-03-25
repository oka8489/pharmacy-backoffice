#!/usr/bin/env python3
"""pages/*.html -> pharmacy_dashboard_8.html"""
import os

base = os.path.dirname(os.path.abspath(__file__))

header = """<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>migiude薬局バックオフィス | アフェット薬局</title>
<link rel="stylesheet" href="migiude.css">
</head>
<body>

<nav>
  <div class="nav-title">migiude薬局バックオフィス | アフェット薬局</div>
  <div class="nav-tab active" onclick="showPage('input')">月次報酬</div>
  <div class="nav-tab" onclick="showPage('r8')">R8改定</div>
  <div class="nav-tab" onclick="showPage('shishutsu')">支出</div>
  <div class="nav-tab" onclick="showPage('kaizen')">経営改善</div>
  <div class="nav-tab" onclick="showPage('calendar')">予定</div>
  <div class="nav-tab" onclick="showPage('zaiko')">在庫管理</div>
  <div class="nav-tab" onclick="showPage('manual')">マニュアル</div>
  <div class="nav-tab" onclick="showPage('auto')">自動化</div>
  <div class="nav-tab" onclick="showPage('memo')">メモ</div>
</nav>

"""

footer = """
<script src="migiude.js"></script>

<div class="modal-overlay" id="badge-modal" onclick="if(event.target===this)this.classList.remove('active')">
  <div class="modal-box">
    <h3 class="modal-title"></h3>
    <span class="badge-type"></span>
    <div class="modal-body"></div>
    <button class="close-btn" onclick="this.closest('.modal-overlay').classList.remove('active')">閉じる</button>
  </div>
</div>

</body>
</html>
"""

pages = [
    ("input", "monthly.html", True),
    ("r8", "r8.html", False),
    ("shishutsu", "shishutsu.html", False),
    ("kaizen", "kaizen.html", False),
    ("calendar", "calendar.html", False),
    ("zaiko", "zaiko.html", False),
    ("manual", "manual.html", False),
    ("auto", "auto.html", False),
    ("memo", "memo.html", False),
]

out = header
for page_id, fname, active in pages:
    path = os.path.join(base, "pages", fname)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if active:
        out += '<div id="page-' + page_id + '" class="page">\n'
    else:
        out += '<div id="page-' + page_id + '" class="page" style="display:none">\n'
    out += content
    out += "\n</div>\n\n"

out += footer

outpath = os.path.join(base, "pharmacy_dashboard_8.html")
with open(outpath, "w", encoding="utf-8") as f:
    f.write(out)

lines = out.count("\n")
size = len(out.encode("utf-8"))
print(f"OK: {outpath}")
print(f"   {lines} lines, {size:,} bytes")
