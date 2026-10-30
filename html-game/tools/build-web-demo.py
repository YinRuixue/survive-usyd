#!/usr/bin/env python3
"""Build the public, browser-only game in output/web-demo using the standard library."""
import hashlib
import re
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "html-game"
OUTPUT = ROOT / "output" / "web-demo"
RUNTIME_FILES = (
    "index.html", "style.css", "game-data.js", "engine.js", "app.js",
    "save-store.js", "save-menu.js", "backend-client.js", "audio.js",
    "display-format.js",
)


def build():
    """Copy only public runtime files, select browser storage and version the entry assets."""
    for name in RUNTIME_FILES:
        if not (SOURCE / name).is_file():
            raise FileNotFoundError(f"Missing game file: {name}")
    if OUTPUT.is_symlink():
        raise ValueError("The generated output directory must not be a symbolic link.")
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)
    for name in RUNTIME_FILES:
        shutil.copy2(SOURCE / name, OUTPUT / name)
    shutil.copytree(SOURCE / "assets", OUTPUT / "assets", ignore=shutil.ignore_patterns(".DS_Store", "__pycache__"))

    index = (OUTPUT / "index.html").read_text(encoding="utf-8")
    marker = '<meta name="survive-runtime" content="auto">'
    if index.count(marker) != 1:
        raise ValueError("Expected exactly one runtime configuration in index.html.")
    index = index.replace(marker, '<meta name="survive-runtime" content="browser">')

    def version_asset(match):
        attribute, filename = match.groups()
        digest = hashlib.sha256((OUTPUT / filename).read_bytes()).hexdigest()[:12]
        return f'{attribute}="{filename}?v={digest}"'

    index = re.sub(r'(src|href)="([^"?]+\.(?:js|css))(?:\?[^"\s]*)?"', version_asset, index)
    (OUTPUT / "index.html").write_text(index, encoding="utf-8")
    (OUTPUT / ".nojekyll").write_text("", encoding="utf-8")
    files = [path for path in OUTPUT.rglob("*") if path.is_file()]
    print(f"Built {len(files)} public files ({sum(p.stat().st_size for p in files) / 1024**2:.1f} MiB) in {OUTPUT.relative_to(ROOT)}")
    print("Browser mode: no Python service or account required; saves stay in the player's browser.")


if __name__ == "__main__":
    build()
