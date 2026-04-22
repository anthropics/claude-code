from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def test_mythos_identity_files_exist() -> None:
    required = [
        "CLAUDE_MYTHOS.md",
        "brand/claude-mythos-brand-kit.md",
        "brand/github-partner-branding-kit.md",
        "docs/readme-mythos-section.md",
        "interactive/mythos_control_panel.html",
        "assets/brand/claude-mythos-wordmark.svg",
        "assets/brand/ethos-aegis-mythos-lockup.svg",
    ]
    for relative_path in required:
        assert (ROOT / relative_path).exists(), f"Missing required file: {relative_path}"


def test_mythos_contract_language_is_aligned() -> None:
    operating_contract = _read("CLAUDE_MYTHOS.md")
    brand_kit = _read("brand/claude-mythos-brand-kit.md")
    partner_kit = _read("brand/github-partner-branding-kit.md")
    readme_section = _read("docs/readme-mythos-section.md")

    expected_phrases = [
        "Claude Mythos",
        "Veriflow",
        "Trust the verified path.",
        "fingerprint_mode=\"auto\"",
    ]

    joined = "\n".join([operating_contract, brand_kit, partner_kit, readme_section])
    for phrase in expected_phrases:
        assert phrase in joined, f"Expected phrase missing: {phrase}"


def test_interactive_panel_mentions_core_modes() -> None:
    html = _read("interactive/mythos_control_panel.html")
    assert "verification-first" in html
    assert "datastore_lightweight" in html
    assert "schema-rich+datastore" in html
