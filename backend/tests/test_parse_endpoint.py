from pathlib import Path
import sys

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


def test_parse_endpoint_uses_campaign_name_for_metadata():
    response = parse_bulk_iocs(
        ParseRequest(raw_text="https://example.com", campaign_name="Lumma Stealer")
    )

    assert response.title == "Block Lumma Stealer Indicators"
    assert response.description == "Indicators associated with the Lumma Stealer campaign."
    assert response.recommended_actions == (
        "Block the listed indicators and investigate any historical communication."
    )


def test_parse_endpoint_uses_generic_metadata_when_campaign_name_missing():
    response = parse_bulk_iocs(ParseRequest(raw_text="https://example.com"))

    assert response.title == "Block Malicious Indicators"
    assert response.description == "Indicators associated with a reported malicious campaign."
    assert response.recommended_actions == (
        "Block the listed indicators and investigate any historical communication."
    )


def test_parse_endpoint_accepts_source_email_text_without_using_it():
    response = parse_bulk_iocs(
        ParseRequest(raw_text="https://example.com", source_email_text="hello from an email")
    )

    assert response.title == "Block Malicious Indicators"
    assert response.description == "Indicators associated with a reported malicious campaign."
    assert response.recommended_actions == (
        "Block the listed indicators and investigate any historical communication."
    )
