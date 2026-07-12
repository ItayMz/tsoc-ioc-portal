from ipaddress import ip_address

from app.enums.indicator_type import IndicatorType
from app.models.ioc import ParsedIOC
from app.services.refang import refang


VALID_LOOKBACK_DAYS = {7, 30, 90, 180, 365}
DEFAULT_LOOKBACK_DAYS = 90


def _escape_kql_string(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return escaped


def _normalize_value(indicator: ParsedIOC) -> str | None:
    raw_value = indicator.refanged_value or indicator.original_value
    if not raw_value:
        return None

    cleaned = refang(raw_value).strip()
    if not cleaned:
        return None

    if indicator.indicator_type in {IndicatorType.FILE_MD5, IndicatorType.FILE_SHA1, IndicatorType.FILE_SHA256}:
        return cleaned.lower()

    if indicator.indicator_type is IndicatorType.DOMAIN_NAME:
        return cleaned.lower()

    if indicator.indicator_type is IndicatorType.IP_ADDRESS:
        try:
            return str(ip_address(refang(cleaned)))
        except ValueError:
            return None

    if indicator.indicator_type is IndicatorType.URL:
        return refang(cleaned)

    return refang(cleaned)


def _deduplicate(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if not value:
            continue
        if value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def _build_dynamic_list(values: list[str]) -> str:
    normalized_values = _deduplicate([value for value in values if value])
    if not normalized_values:
        return "dynamic([])"

    escaped_values = [f'"{_escape_kql_string(value)}"' for value in normalized_values]
    return "dynamic([" + ", ".join(escaped_values) + "])"


def _normalize_lookback_days(lookback_days: int | None) -> int:
    if lookback_days in VALID_LOOKBACK_DAYS:
        return lookback_days
    return DEFAULT_LOOKBACK_DAYS


def _build_query(template: str, variable_name: str, values: list[str], lookback_days: int) -> str | None:
    normalized_values = _deduplicate([value for value in values if value])
    if not normalized_values:
        return None

    dynamic_list = _build_dynamic_list(normalized_values)
    return template.format(variable_name=variable_name, dynamic_list=dynamic_list, lookback_days=lookback_days)


def _build_url_domain_query(values: list[str], lookback_days: int) -> str | None:
    normalized_values = _deduplicate([value for value in values if value])
    if not normalized_values:
        return None

    conditions: list[str] = []
    for value in normalized_values:
        escaped = _escape_kql_string(value)
        conditions.append(f'Url contains "{escaped}"')
        conditions.append(f'RemoteUrl contains "{escaped}"')

    where_clause = "\n    or ".join(conditions)
    return (
        "EmailUrlInfo\n"
        "| union DeviceNetworkEvents\n"
        f"| where Timestamp >= ago({lookback_days}d)\n"
        f"| where {where_clause}\n"
        "| limit 10"
    )


def build_kql_queries(grouped_iocs: dict[str, list[ParsedIOC]], lookback_days: int | None = None) -> dict[str, dict[str, object] | None]:
    resolved_lookback_days = _normalize_lookback_days(lookback_days)
    md5_values = [
        _normalize_value(indicator)
        for indicator in grouped_iocs.get("md5", [])
        if indicator.indicator_type is IndicatorType.FILE_MD5
    ]
    sha1_values = [
        _normalize_value(indicator)
        for indicator in grouped_iocs.get("sha1", [])
        if indicator.indicator_type is IndicatorType.FILE_SHA1
    ]
    sha256_values = [
        _normalize_value(indicator)
        for indicator in grouped_iocs.get("sha256", [])
        if indicator.indicator_type is IndicatorType.FILE_SHA256
    ]
    ipv4_values = [
        _normalize_value(indicator)
        for indicator in grouped_iocs.get("ipv4", [])
        if indicator.indicator_type is IndicatorType.IP_ADDRESS
    ]
    ipv6_values = [
        _normalize_value(indicator)
        for indicator in grouped_iocs.get("ipv6", [])
        if indicator.indicator_type is IndicatorType.IP_ADDRESS
    ]
    domain_values = [
        _normalize_value(indicator)
        for indicator in grouped_iocs.get("domains", [])
        if indicator.indicator_type is IndicatorType.DOMAIN_NAME
    ]
    url_values = [
        _normalize_value(indicator)
        for indicator in grouped_iocs.get("urls", [])
        if indicator.indicator_type is IndicatorType.URL
    ]
    file_hash_values = _deduplicate([*md5_values, *sha1_values, *sha256_values])
    ip_values = _deduplicate([*ipv4_values, *ipv6_values])
    url_domain_values = _deduplicate([*domain_values, *url_values])

    queries = {
        "fileHash": {
            "query": _build_query(
                "let IOC_HASHES = {dynamic_list};\n"
                "union\n"
                "    DeviceProcessEvents,\n"
                "    DeviceNetworkEvents,\n"
                "    DeviceFileEvents,\n"
                "    DeviceRegistryEvents,\n"
                "    EmailAttachmentInfo\n"
                "| where Timestamp >= ago({lookback_days}d)\n"
                "| where SHA1 has_any (IOC_HASHES)\n"
                "    or MD5 has_any (IOC_HASHES)\n"
                "    or SHA256 has_any (IOC_HASHES)\n"
                "    or InitiatingProcessSHA1 has_any (IOC_HASHES)\n"
                "    or InitiatingProcessMD5 has_any (IOC_HASHES)\n"
                "    or InitiatingProcessSHA256 has_any (IOC_HASHES)\n"
                "| limit 10",
                "IOC_HASHES",
                file_hash_values,
                resolved_lookback_days,
            ),
            "count": len(file_hash_values),
            "lookbackDays": resolved_lookback_days,
            "tables": [
                "DeviceProcessEvents",
                "DeviceNetworkEvents",
                "DeviceFileEvents",
                "DeviceRegistryEvents",
                "EmailAttachmentInfo",
            ],
        },
        "ip": {
            "query": _build_query(
                "let IOC_IPS = {dynamic_list};\n"
                "DeviceNetworkEvents\n"
                "| where Timestamp >= ago({lookback_days}d)\n"
                "| where RemoteIP in (IOC_IPS)\n"
                "    or LocalIP in (IOC_IPS)\n"
                "| limit 10",
                "IOC_IPS",
                ip_values,
                resolved_lookback_days,
            ),
            "count": len(ip_values),
            "lookbackDays": resolved_lookback_days,
            "tables": ["DeviceNetworkEvents"],
        },
        "urlWebDomain": {
            "query": _build_url_domain_query(url_domain_values, resolved_lookback_days),
            "count": len(url_domain_values),
            "lookbackDays": resolved_lookback_days,
            "tables": ["EmailUrlInfo", "DeviceNetworkEvents"],
        },
    }

    return {key: value if value["query"] else None for key, value in queries.items()}
