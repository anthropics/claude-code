"""Seed baseline tech tags (P1-05).

`python manage.py seed_tags` で fixture `tech_tags.json` を idempotent に取り込む.

通常の `loaddata` は pk 衝突時に IntegrityError を起こすため、
ここでは `update_or_create` で既存行をマージする実装にしている.
同じコマンドを何度呼んでも最終状態が一致することを保証する.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.tags.models import Tag

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "tech_tags.json"


class Command(BaseCommand):
    help = "Seed baseline tech tags from apps/tags/fixtures/tech_tags.json (idempotent)."

    def add_arguments(self, parser: argparse.ArgumentParser) -> None:
        parser.add_argument(
            "--fixture",
            default=str(FIXTURE_PATH),
            help="Path to the fixture JSON (defaults to apps/tags/fixtures/tech_tags.json).",
        )

    def handle(self, *args, **options) -> None:
        fixture_path = Path(options["fixture"])
        if not fixture_path.is_file():
            raise CommandError(f"Fixture not found: {fixture_path}")

        try:
            data = json.loads(fixture_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON in {fixture_path}: {exc}") from exc

        if not isinstance(data, list):
            raise CommandError("Fixture must be a JSON list of Django fixture entries.")

        created_count = 0
        updated_count = 0
        for entry in data:
            if entry.get("model") != "tags.tag":
                # 他モデルの行が混入していた場合は無視 (将来別モデルを混ぜる可能性があるため)
                continue
            fields = entry.get("fields") or {}
            name = fields.get("name")
            if not name:
                continue

            defaults = {
                "display_name": fields.get("display_name", name),
                "description": fields.get("description", ""),
                "is_approved": fields.get("is_approved", True),
                # seed タグには created_by を与えない (システム投入)
                "created_by": None,
            }
            # usage_count は tweets 側が更新するため、seed では初期値のみ尊重
            # (既存行の usage_count を 0 に戻さないよう update_or_create の defaults には含めない)
            # Tag.objects は is_approved=True に絞り込む ApprovedTagManager のため、
            # 未承認で事前作成されたテスト行も含めて更新できるよう all_objects を使う。
            tag, created = Tag.all_objects.update_or_create(name=name.lower(), defaults=defaults)
            if created:
                # 初回作成時のみ usage_count の初期値を fixture に合わせる
                desired_usage = fields.get("usage_count", 0)
                if tag.usage_count != desired_usage:
                    tag.usage_count = desired_usage
                    tag.save(update_fields=["usage_count"])
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"seed_tags: created={created_count}, updated={updated_count}, "
                f"total_in_fixture={len(data)}"
            )
        )
