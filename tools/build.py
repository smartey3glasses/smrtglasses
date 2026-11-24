from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "templates" / "index.template.html"
PARTS = {
    "HEAD": (ROOT / "templates" / "head.html"),
    "GLOBAL_MODALS": ROOT / "components" / "global-modals.html",
    "LOGIN": ROOT / "pages" / "login.html",
    "SIDEBAR": ROOT / "layout" / "sidebar.html",
    "TOPBAR": ROOT / "layout" / "topbar.html",
    "OVERVIEW": ROOT / "pages" / "overview.html",
    "LOCATION": ROOT / "pages" / "location.html",
    "EVENTS": ROOT / "pages" / "events.html",
    "DEVICES": ROOT / "pages" / "devices.html",
    "ACCESS": ROOT / "pages" / "access.html",
    "FAMILY_MODAL": ROOT / "components" / "family-access-modal.html",
    "PROFILE_MENU": ROOT / "components" / "profile-menu.html",
}

def main():
    html = TEMPLATE.read_text(encoding="utf-8")
    for key, path in PARTS.items():
        html = html.replace("{" + key + "}", path.read_text(encoding="utf-8"))
    (ROOT / "index.html").write_text(html, encoding="utf-8")
    print("Built index.html from the organized HTML parts.")

if __name__ == "__main__":
    main()
