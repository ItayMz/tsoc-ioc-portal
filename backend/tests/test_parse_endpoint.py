from pathlib import Path
import sys
import time

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.enums.indicator_type import IndicatorType
from app.routes.parse import ParseRequest, parse_bulk_iocs
from app.services.parser import parse_bulk_text


def test_parse_endpoint_returns_bulk_results():
    response = parse_bulk_iocs(
        ParseRequest(raw_text="https://example.com 8.8.8.8 user@example.com")
    )

    assert response.total_count == 3
    assert response.valid_count == 3
    assert response.invalid_count == 0
    assert [indicator.indicator_type.value for indicator in response.indicators] == [
        "Url",
        "IpAddress",
        "SenderEmailAddress",
    ]
    assert response.counts_by_type == {
        "Url": 1,
        "IpAddress": 1,
        "SenderEmailAddress": 1,
    }


def test_parse_endpoint_deduplicates_normalized_domains():
    response = parse_bulk_iocs(ParseRequest(raw_text="evil[.]com evil.com evil[.]com"))

    assert response.total_count == 1
    assert response.valid_count == 1
    assert response.invalid_count == 0
    assert response.indicators[0].refanged_value == "evil.com"
    assert response.indicators[0].indicator_type is not None
    assert response.indicators[0].indicator_type is IndicatorType.DOMAIN_NAME
    assert response.counts_by_type == {"DomainName": 1}


def test_parse_bulk_text_extracts_iocs_from_free_text():
    indicators = parse_bulk_text(
        "URL: hxxps[://]evil[.]com\nDomain - evil[.]com\nIP Address: 1[.]2[.]3[.]4\nIOC: test[@]example[.]com\nIndicators: evil[.]com, 8[.]8[.]8[.]8; hxxps[://]bad[.]com/login"
    )

    assert [indicator.refanged_value for indicator in indicators] == [
        "https://evil.com",
        "evil.com",
        "1.2.3.4",
        "test@example.com",
        "8.8.8.8",
        "https://bad.com/login",
    ]
    assert [indicator.indicator_type for indicator in indicators] == [
        IndicatorType.URL,
        IndicatorType.DOMAIN_NAME,
        IndicatorType.IP_ADDRESS,
        IndicatorType.SENDER_EMAIL_ADDRESS,
        IndicatorType.IP_ADDRESS,
        IndicatorType.URL,
    ]


def test_parse_endpoint_returns_correct_actions_for_hashes_and_urls():
    response = parse_bulk_iocs(
        ParseRequest(
            raw_text=" ".join(["a" * 32, "b" * 40, "c" * 64, "https://example.com"])
        )
    )

    indicators = response.indicators
    payload = response.model_dump(mode="json")

    assert [indicator.indicator_type.value for indicator in indicators] == [
        "FileMd5",
        "FileSha1",
        "FileSha256",
        "Url",
    ]
    assert [indicator.action.value for indicator in indicators] == [
        "BlockAndRemediate",
        "BlockAndRemediate",
        "BlockAndRemediate",
        "Block",
    ]
    assert [item["action"] for item in payload["indicators"]] == [
        "BlockAndRemediate",
        "BlockAndRemediate",
        "BlockAndRemediate",
        "Block",
    ]


def test_parse_endpoint_includes_kql_queries_with_existing_ioc_output():
    response = parse_bulk_iocs(ParseRequest(raw_text="https://example.com"))

    assert response.total_count == 1
    assert response.valid_count == 1
    assert response.indicators[0].indicator_type is IndicatorType.URL
    assert response.kqlQueries["urlWebDomain"] is not None
    assert response.kqlQueries["fileHash"] is None
    assert response.kqlQueries["urlWebDomain"]["query"].startswith("EmailUrlInfo")


def test_parse_endpoint_kql_queries_contract_uses_only_official_keys():
    response = parse_bulk_iocs(ParseRequest(raw_text="https://example.com 8.8.8.8 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))

    assert set(response.kqlQueries.keys()) == {"fileHash", "ip", "urlWebDomain"}

    legacy_keys = {"md5", "sha1", "sha256", "ipv4", "ipv6", "domains", "urls"}
    assert legacy_keys.isdisjoint(response.kqlQueries.keys())


def test_parse_endpoint_uses_campaign_name_for_metadata():
    response = parse_bulk_iocs(
        ParseRequest(raw_text="https://example.com", campaign_name="Lumma Stealer")
    )

    assert response.title == "Lumma Stealer IOC"
    assert response.description == "Indicators associated with Lumma Stealer."
    assert response.recommended_actions == ""


def test_parse_endpoint_accepts_camel_case_campaign_name_field():
    response = parse_bulk_iocs(
        ParseRequest(raw_text="https://example.com", campaignName="DarkGate")
    )

    assert response.title == "DarkGate IOC"
    assert response.description == "Indicators associated with DarkGate."


def test_parse_endpoint_prefers_campaign_name_over_legacy_campaign_name():
    response = parse_bulk_iocs(
        ParseRequest(
            raw_text="https://example.com",
            campaign_name="Legacy Campaign",
            campaignName="Manual Campaign",
        )
    )

    assert response.title == "Manual Campaign IOC"
    assert response.description == "Indicators associated with Manual Campaign."


def test_parse_endpoint_uses_generic_metadata_when_campaign_name_missing():
    response = parse_bulk_iocs(ParseRequest(raw_text="https://example.com"))

    assert response.title == "IOC Sweep"
    assert response.description == "Indicators submitted for IOC sweep."
    assert response.recommended_actions == ""


def test_parse_endpoint_accepts_source_email_text_without_using_it():
    response = parse_bulk_iocs(
        ParseRequest(raw_text="https://example.com", source_email_text="hello from an email")
    )

    assert response.title == "IOC Sweep"
    assert response.description == "Indicators submitted for IOC sweep."
    assert response.recommended_actions == ""


def test_parse_endpoint_uses_most_common_ioc_metadata_campaign_when_missing_manual_name():
    response = parse_bulk_iocs(
        ParseRequest(
            raw_text="https://example.com evil.com",
            iocMetadata=[
                {"value": "https://example.com", "campaignName": "Storm-123"},
                {"value": "evil.com", "campaignName": "Storm-123"},
                {"value": "8.8.8.8", "campaignName": "Other"},
            ],
        )
    )

    assert response.title == "Storm-123 IOC"
    assert response.description == "Indicators associated with Storm-123."


def test_parse_endpoint_handles_empty_text_input_gracefully():
    response = parse_bulk_iocs(ParseRequest(raw_text="   \n  "))

    assert response.total_count == 0
    assert response.valid_count == 0
    assert response.invalid_count == 0
    assert response.indicators == []
    assert response.kqlQueries["urlWebDomain"] is None


def test_parse_endpoint_raises_clear_error_for_malformed_upload_payload():
    with pytest.raises(ValueError):
        parse_bulk_iocs(ParseRequest(raw_text=None))


def test_parse_endpoint_includes_processing_summary_counts():
    response = parse_bulk_iocs(
        ParseRequest(raw_text="https://example.com https://example.com 8.8.8.8 8.8.8.8 evil[.]com evil.com a" * 32)
    )

    assert response.summary.processed > 0
    assert response.summary.md5 == 0
    assert response.summary.sha1 == 0
    assert response.summary.sha256 == 0
    assert response.summary.ipv4 == 1
    assert response.summary.ipv6 == 0
    assert response.summary.domains == 1
    assert response.summary.urls == 1
    assert response.summary.duplicatesRemoved >= 1
    assert response.summary.queriesGenerated == 2


def test_large_mixed_ioc_input_completes_quickly():
    large_input = []
    for index in range(10000):
        large_input.append(f"https://example{index % 100}.com")
        large_input.append(f"8.8.{index % 255}.1")
        large_input.append(f"example{index % 100}.com")
        large_input.append(f"{index:032x}")

    start_time = time.perf_counter()
    response = parse_bulk_iocs(ParseRequest(raw_text=" ".join(large_input)))
    elapsed = time.perf_counter() - start_time

    print(f"Large mixed IOC parse elapsed: {elapsed:.4f}s")

    assert response.summary.processed == 10455
    assert response.summary.queriesGenerated >= 1
    assert elapsed < 5.0
