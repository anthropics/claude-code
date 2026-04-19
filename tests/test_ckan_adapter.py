from __future__ import annotations

import pytest

from ethos_aegis.veriflow.ckan_adapter import (
    CKANCapabilityMatrix,
    CKANClient,
    CKANVersion,
    CapabilityRecord,
    SchemaField,
)


# ---------------------------------------------------------------------------
# CKANVersion.parse
# ---------------------------------------------------------------------------


def test_parse_full_semver() -> None:
    v = CKANVersion.parse("2.11.4")
    assert v.major == 2
    assert v.minor == 11
    assert v.patch == 4
    assert v.prerelease is None
    assert v.raw == "2.11.4"


def test_parse_empty_string_returns_unknown() -> None:
    v = CKANVersion.parse("")
    assert v.raw == "unknown"
    assert v.major is None


def test_parse_none_like_empty() -> None:
    v = CKANVersion.parse("   ")
    assert v.raw == "unknown"


def test_parse_prerelease_alpha() -> None:
    v = CKANVersion.parse("2.10a1")
    assert v.major == 2
    assert v.minor == 10
    assert v.prerelease == "a1"


def test_parse_prerelease_rc() -> None:
    v = CKANVersion.parse("3.0rc2")
    assert v.major == 3
    assert v.prerelease == "rc2"


def test_parse_prerelease_beta() -> None:
    v = CKANVersion.parse("2.9b3")
    assert v.prerelease == "b3"


def test_parse_non_numeric_part() -> None:
    v = CKANVersion.parse("2.x.1")
    assert v.major == 2
    assert v.minor is None
    assert v.patch == 1


def test_parse_short_version() -> None:
    v = CKANVersion.parse("2.11")
    assert v.major == 2
    assert v.minor == 11
    assert v.patch is None


def test_parse_single_digit() -> None:
    v = CKANVersion.parse("3")
    assert v.major == 3
    assert v.minor is None
    assert v.patch is None


# ---------------------------------------------------------------------------
# CKANCapabilityMatrix.supports
# ---------------------------------------------------------------------------


def _matrix_with(name: str, state: str) -> CKANCapabilityMatrix:
    return CKANCapabilityMatrix(
        api_base="https://example.com/api/3/action",
        version=CKANVersion.parse("2.11.0"),
        capabilities={name: CapabilityRecord(name=name, state=state)},
    )


def test_supports_available() -> None:
    assert _matrix_with("datastore", "available").supports("datastore") is True


def test_supports_inferred() -> None:
    assert _matrix_with("datastore", "inferred").supports("datastore") is True


def test_supports_partial() -> None:
    assert _matrix_with("datastore", "partial").supports("datastore") is True


def test_supports_unavailable() -> None:
    assert _matrix_with("datastore", "unavailable").supports("datastore") is False


def test_supports_missing_key() -> None:
    matrix = CKANCapabilityMatrix(
        api_base="https://example.com",
        version=CKANVersion.parse("2.11.0"),
        capabilities={},
    )
    assert matrix.supports("datastore") is False


# ---------------------------------------------------------------------------
# CKANCapabilityMatrix.to_dict
# ---------------------------------------------------------------------------


def test_to_dict_structure() -> None:
    matrix = CKANCapabilityMatrix(
        api_base="https://example.com/api/3/action",
        version=CKANVersion.parse("2.11.4"),
        capabilities={
            "datastore": CapabilityRecord(name="datastore", state="available", source="api", detail="ok"),
        },
    )
    d = matrix.to_dict()
    assert d["api_base"] == "https://example.com/api/3/action"
    assert d["version"]["major"] == 2
    assert d["version"]["minor"] == 11
    assert d["version"]["patch"] == 4
    assert "datastore" in d["capabilities"]
    assert d["capabilities"]["datastore"]["state"] == "available"
    assert d["capabilities"]["datastore"]["source"] == "api"


def test_to_dict_empty_capabilities() -> None:
    matrix = CKANCapabilityMatrix(
        api_base="https://x.com",
        version=CKANVersion.parse("1.0.0"),
    )
    d = matrix.to_dict()
    assert d["capabilities"] == {}


# ---------------------------------------------------------------------------
# CKANClient
# ---------------------------------------------------------------------------


def test_ckan_client_probe_capabilities_returns_matrix() -> None:
    client = CKANClient("https://data.example.com/")
    matrix = client.probe_capabilities()
    assert matrix.api_base == "https://data.example.com/api/3/action"
    assert isinstance(matrix.version, CKANVersion)
    assert matrix.capabilities == {}


def test_ckan_client_strips_trailing_slash() -> None:
    client = CKANClient("https://data.example.com///")
    assert not client.base_url.endswith("/")


def test_ckan_client_ingest_resource_raises() -> None:
    client = CKANClient("https://data.example.com")
    with pytest.raises(NotImplementedError):
        client.ingest_resource("some-id")


def test_ckan_client_api_key_stored() -> None:
    client = CKANClient("https://data.example.com", api_key="secret-token")
    assert client.api_key == "secret-token"


# ---------------------------------------------------------------------------
# SchemaField defaults
# ---------------------------------------------------------------------------


def test_schema_field_defaults() -> None:
    field = SchemaField(name="count")
    assert field.field_type == "string"
    assert field.label is None
    assert field.aliases == ()


def test_schema_field_custom() -> None:
    field = SchemaField(name="visits", field_type="integer", label="Visits", unit="count")
    assert field.field_type == "integer"
    assert field.label == "Visits"
    assert field.unit == "count"
