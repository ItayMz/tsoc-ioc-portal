from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.enums.indicator_type import IndicatorType
from app.models.ioc import ParsedIOC
from app.services.kql_builder import build_kql_queries


def _ioc(value: str, indicator_type: IndicatorType) -> ParsedIOC:
    return ParsedIOC(
        original_value=value,
        refanged_value=value,
        indicator_type=indicator_type,
        valid=True,
    )


def test_file_hash_query_combines_md5_sha1_sha256_and_uses_official_tables_and_fields():
    queries = build_kql_queries(
        {
            "md5": [_ioc("ABCDEF0123456789ABCDEF0123456789", IndicatorType.FILE_MD5)],
            "sha1": [_ioc("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", IndicatorType.FILE_SHA1)],
            "sha256": [_ioc("b" * 64, IndicatorType.FILE_SHA256)],
        }
    )

    query = queries["fileHash"]["query"]
    assert query is not None
    assert "let IOC_HASHES = dynamic([" in query
    assert "abcdef0123456789abcdef0123456789" in query
    assert "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" in query
    assert '"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"' in query
    assert "DeviceProcessEvents" in query
    assert "DeviceNetworkEvents" in query
    assert "DeviceFileEvents" in query
    assert "DeviceRegistryEvents" in query
    assert "EmailAttachmentInfo" in query
    assert "DeviceEvents" not in query
    assert "SHA1 has_any (IOC_HASHES)" in query
    assert "MD5 has_any (IOC_HASHES)" in query
    assert "SHA256 has_any (IOC_HASHES)" in query
    assert "InitiatingProcessSHA1 has_any (IOC_HASHES)" in query
    assert "InitiatingProcessMD5 has_any (IOC_HASHES)" in query
    assert "InitiatingProcessSHA256 has_any (IOC_HASHES)" in query
    assert "has_any" in query
    assert "| limit 10" in query
    assert "search" not in query.lower()
    assert queries["fileHash"]["tables"] == [
        "DeviceProcessEvents",
        "DeviceNetworkEvents",
        "DeviceFileEvents",
        "DeviceRegistryEvents",
        "EmailAttachmentInfo",
    ]


def test_ip_query_combines_ipv4_ipv6_and_uses_remote_local_in_lookup():
    queries = build_kql_queries(
        {
            "ipv4": [_ioc("8.8.8.8", IndicatorType.IP_ADDRESS)],
            "ipv6": [_ioc("2001:db8::1", IndicatorType.IP_ADDRESS)],
        }
    )

    query = queries["ip"]["query"]
    assert query is not None
    assert "let IOC_IPS = dynamic([" in query
    assert '"8.8.8.8"' in query
    assert '"2001:db8::1"' in query
    assert "DeviceNetworkEvents" in query
    assert "| where RemoteIP in (IOC_IPS)" in query
    assert "or LocalIP in (IOC_IPS)" in query
    assert "| limit 10" in query
    assert queries["ip"]["tables"] == ["DeviceNetworkEvents"]


def test_url_web_domain_query_combines_domains_urls_with_contains_on_official_tables_and_fields():
    queries = build_kql_queries(
        {
            "domains": [_ioc("evil[.]com", IndicatorType.DOMAIN_NAME)],
            "urls": [_ioc("hxxps://evil[.]com/path?a=1", IndicatorType.URL)],
        }
    )

    query = queries["urlWebDomain"]["query"]
    assert query is not None
    assert "EmailUrlInfo" in query
    assert "| union DeviceNetworkEvents" in query
    assert 'Url contains "evil.com"' in query
    assert 'RemoteUrl contains "evil.com"' in query
    assert 'Url contains "https://evil.com/path?a=1"' in query
    assert 'RemoteUrl contains "https://evil.com/path?a=1"' in query
    assert "contains" in query
    assert "| limit 10" in query
    assert "DeviceDnsEvents" not in query
    assert "UrlClickEvents" not in query
    assert "AlertEvidence" not in query
    assert queries["urlWebDomain"]["tables"] == ["EmailUrlInfo", "DeviceNetworkEvents"]


def test_url_web_domain_query_includes_sender_email_indicators_in_existing_emailurlinfo_query():
    queries = build_kql_queries(
        {
            "senderEmailAddresses": [
                _ioc("analyst@test.com", IndicatorType.SENDER_EMAIL_ADDRESS),
            ],
        }
    )

    query = queries["urlWebDomain"]["query"]
    assert query is not None
    assert "EmailUrlInfo" in query
    assert '| where Url contains "analyst@test.com"' in query
    assert '| where RemoteUrl contains "analyst@test.com"' in query or 'RemoteUrl contains "analyst@test.com"' in query
    assert queries["urlWebDomain"]["count"] == 1


def test_url_web_domain_query_deduplicates_sender_email_values():
    queries = build_kql_queries(
        {
            "senderEmailAddresses": [
                _ioc("Analyst@Test.com", IndicatorType.SENDER_EMAIL_ADDRESS),
                _ioc("analyst@test.com", IndicatorType.SENDER_EMAIL_ADDRESS),
                _ioc("analyst@test.com", IndicatorType.SENDER_EMAIL_ADDRESS),
            ],
        }
    )

    query = queries["urlWebDomain"]["query"]
    assert query is not None
    assert '\n| where Url contains "analyst@test.com"' in query
    assert '\n    or RemoteUrl contains "analyst@test.com"' in query
    assert 'Analyst@Test.com' not in query
    assert queries["urlWebDomain"]["count"] == 1


def test_only_three_official_query_types_are_returned_and_empty_categories_are_not_generated():
    queries = build_kql_queries({"md5": [_ioc("abc", IndicatorType.FILE_MD5)]})

    assert set(queries.keys()) == {"fileHash", "ip", "urlWebDomain"}
    assert queries["fileHash"] is not None
    assert queries["ip"] is None
    assert queries["urlWebDomain"] is None


def test_lookback_is_preserved_and_invalid_lookback_defaults_to_90_days():
    query_30 = build_kql_queries({"md5": [_ioc("abc", IndicatorType.FILE_MD5)]}, lookback_days=30)
    query_invalid = build_kql_queries({"md5": [_ioc("abc", IndicatorType.FILE_MD5)]}, lookback_days=999)

    assert "ago(30d)" in query_30["fileHash"]["query"]
    assert "ago(90d)" in query_invalid["fileHash"]["query"]
    assert query_30["fileHash"]["lookbackDays"] == 30
    assert query_invalid["fileHash"]["lookbackDays"] == 90


def test_no_unrestricted_search_operator_is_generated_for_any_query_type():
    queries = build_kql_queries(
        {
            "md5": [_ioc("abc", IndicatorType.FILE_MD5)],
            "ipv4": [_ioc("8.8.8.8", IndicatorType.IP_ADDRESS)],
            "domains": [_ioc("example.com", IndicatorType.DOMAIN_NAME)],
        }
    )

    for key in ["fileHash", "ip", "urlWebDomain"]:
        query = queries[key]["query"]
        assert query is not None
        assert "search" not in query.lower()
