"""
mythos_startup.py — Claude Mythos × Veriflow scaffold bootstrap example.

This module demonstrates how to initialise the Mythos identity scaffold on top
of the Veriflow immune system. It follows the recommended startup defaults from
the Claude Mythos operating contract:

  probe_on_startup=True
  fingerprint_mode="auto"
  datastore_lightweight only when row-level freshness matters more than probe cost

Running this file directly will print the host capability profile as JSON.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

from ethos_aegis.veriflow import CKANClient, VeriflowImmuneSystem

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
_log = logging.getLogger("mythos_startup")


def build_mythos(
    host_url: str,
    sample_resource_id: str | None = None,
    *,
    probe_on_startup: bool = True,
    fingerprint_mode: str = "auto",
    state_dir: str | Path | None = None,
) -> VeriflowImmuneSystem:
    """Initialise the Mythos scaffold and return a bootstrapped immune system.

    Parameters
    ----------
    host_url:
        Base URL of the CKAN host to fingerprint and ingest from.
    sample_resource_id:
        Optional resource UUID used to exercise the datastore probe on startup.
    probe_on_startup:
        When True (the recommended default) the host capabilities are probed
        immediately so the capability matrix is available before any ingestion.
    fingerprint_mode:
        Controls how the immune system identifies the host profile.
        "auto" selects the best strategy available (recommended default).
    state_dir:
        Optional directory for persisting host state and the memory ledger.
        Defaults to a temporary directory when not provided.

    Returns
    -------
    VeriflowImmuneSystem
        A fully bootstrapped immune system instance carrying the host's
        capability matrix.
    """
    _log.info(
        "Initialising Claude Mythos scaffold — host=%s fingerprint_mode=%s",
        host_url,
        fingerprint_mode,
    )
    ckan = CKANClient(host_url)
    immune = VeriflowImmuneSystem(
        ckan,
        probe_on_startup=probe_on_startup,
        sample_resource_id=sample_resource_id,
        fingerprint_mode=fingerprint_mode,
        state_dir=state_dir,
    )
    matrix = immune.capability_matrix
    if matrix is not None:
        _log.info(
            "Host fingerprinted — version=%s capabilities=%s",
            matrix.version.raw,
            list(matrix.capabilities.keys()),
        )
    else:
        _log.warning("Capability matrix unavailable after bootstrap.")
    return immune


def generate_output(immune: VeriflowImmuneSystem) -> dict:
    """Build the expected Mythos output shape from the bootstrapped immune system.

    The output follows the contract documented in
    docs/claude-mythos-veriflow-scaffold.md:

    {
      "host_profile": "<profile-string>",
      "ckan_version": "<semver>",
      "ingestion_path": "<path>",
      "formula": "<example-formula>",
      "limitations": [<list-of-strings>]
    }
    """
    matrix = immune.capability_matrix
    if matrix is None:
        return {
            "host_profile": "unknown",
            "ckan_version": "unknown",
            "ingestion_path": "unknown",
            "formula": None,
            "limitations": ["capability matrix unavailable"],
        }

    has_datastore = matrix.supports("datastore")
    has_schema = matrix.supports("schema")

    if has_datastore and has_schema:
        host_profile = "schema-rich+datastore"
        ingestion_path = "datastore"
        limitations: list[str] = []
    elif has_datastore:
        host_profile = "datastore-only"
        ingestion_path = "datastore"
        limitations = ["schema fields inferred from row sample"]
    else:
        host_profile = "metadata-only"
        ingestion_path = "metadata"
        limitations = ["sampled row signature used", "no datastore endpoint available"]

    return {
        "host_profile": host_profile,
        "ckan_version": matrix.version.raw,
        "ingestion_path": ingestion_path,
        "formula": "ctr = clicks / impressions",
        "limitations": limitations,
    }


if __name__ == "__main__":
    host = sys.argv[1] if len(sys.argv) > 1 else "https://demo.ckan.org"
    try:
        mythos = build_mythos(host)
        output = generate_output(mythos)
        print(json.dumps(output, indent=2))
    except (OSError, ValueError, RuntimeError) as exc:
        _log.error("Mythos startup failed: %s", exc)
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001 — catch-all for standalone script entry point
        _log.error("Unexpected error during Mythos startup: %s", exc)
        sys.exit(1)

