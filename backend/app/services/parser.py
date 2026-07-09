import csv
import io
import re
from ipaddress import ip_address

from app.enums.action import Action
from app.enums.category import Category
from app.enums.indicator_type import IndicatorType
from app.models.ioc import ParsedIOC
from app.services.refang import refang


LABELS = {
    "url",
    "domain",
    "ip",
    "ipaddress",
    "address",
    "ioc",
    "indicators",
    "indicator",
}

SEPARATORS = {",", ";", ":", "|", "(", ")", "[", "]", "{", "}"}
MAX_LINE_LENGTH = 8192
MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024
MAX_RAW_TEXT_SIZE_BYTES = 5 * 1024 * 1024


def validate_raw_text_size(raw_text: str | None) -> None:
    if raw_text is None:
        return

    if len(str(raw_text).encode("utf-8")) > MAX_RAW_TEXT_SIZE_BYTES:
        raise ValueError("Pasted text exceeds the 5 MB limit.")


def _extract_candidates(raw_text: str) -> list[str]:
    if raw_text is None:
        return []

    if not isinstance(raw_text, str):
        raw_text = str(raw_text)

    candidate_tokens: list[str] = []
    for raw_line in raw_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        cleaned = re.sub(r"(?i)\b(?:url|domain|ip|address|ioc|indicators?|indicator)\b\s*[-:]+\s*", "", line)
        cleaned = re.sub(r"(?i)\b(?:url|domain|ip|address|ioc|indicators?|indicator)\b", "", cleaned)

        for token in re.split(r"[\s,;|]+", cleaned):
            normalized_token = token.strip("()[]{}:;,'\"")
            if not normalized_token:
                continue

            if normalized_token.lower() in LABELS:
                continue

            if any(char in normalized_token for char in SEPARATORS):
                if normalized_token in SEPARATORS:
                    continue

            candidate_tokens.append(normalized_token)

    return candidate_tokens


def _deduplicate_indicators(indicators: list[ParsedIOC]) -> list[ParsedIOC]:
    seen: set[tuple[IndicatorType | None, str]] = set()
    deduplicated: list[ParsedIOC] = []

    for indicator in indicators:
        key = (indicator.indicator_type, indicator.refanged_value.lower())
        if key in seen:
            continue

        seen.add(key)
        deduplicated.append(indicator)

    return deduplicated


def parse_iocs(values: list[str]) -> list[ParsedIOC]:
    indicators = [parse_ioc(value) for value in values if isinstance(value, str) and value.strip()]
    return _deduplicate_indicators(indicators)


def parse_bulk_text(raw_text: str) -> list[ParsedIOC]:
    values = _extract_candidates(raw_text)
    return parse_iocs(values)


def prepare_text_from_upload(file_bytes: bytes, filename: str) -> str:
    if not file_bytes:
        raise ValueError("The uploaded file is empty.")

    if len(file_bytes) > MAX_UPLOAD_FILE_SIZE_BYTES:
        raise ValueError("The uploaded file exceeds the 5 MB limit.")

    if not filename or not filename.lower().endswith((".csv", ".txt")):
        raise ValueError("Unsupported file type. Please upload a .csv or .txt file.")

    try:
        text = file_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("The uploaded file could not be decoded as UTF-8.") from exc

    if not text.strip():
        raise ValueError("The uploaded file is empty.")

    rows: list[list[str]] = []
    try:
        for row in csv.reader(io.StringIO(text), skipinitialspace=True):
            if not row:
                continue
            if len(row) != 1:
                raise ValueError("Malformed CSV file. Please provide one IOC per line.")
            rows.append([row[0].strip()])
    except csv.Error as exc:
        raise ValueError("Malformed CSV file. Please provide one IOC per line.") from exc

    if not rows:
        raise ValueError("The uploaded file is empty.")

    normalized_lines = []
    for row in rows:
        value = row[0].strip()
        if value:
            normalized_lines.append(value)

    return "\n".join(normalized_lines)


def parse_ioc(value: str) -> ParsedIOC:
    if value is None:
        value = ""

    cleaned_value = str(value).strip()
    refanged_value = refang(cleaned_value)

    if not cleaned_value:
        return ParsedIOC(
            original_value=value,
            refanged_value=refanged_value,
            valid=False,
            reason="empty_value",
        )

    if len(cleaned_value) > MAX_LINE_LENGTH:
        return ParsedIOC(
            original_value=value,
            refanged_value=refanged_value,
            valid=False,
            reason="line_too_long",
        )

    if re.fullmatch(r"[0-9a-fA-F]{32}", refanged_value):
        indicator_type = IndicatorType.FILE_MD5
    elif re.fullmatch(r"[0-9a-fA-F]{40}", refanged_value):
        indicator_type = IndicatorType.FILE_SHA1
    elif re.fullmatch(r"[0-9a-fA-F]{64}", refanged_value):
        indicator_type = IndicatorType.FILE_SHA256
    else:
        try:
            ip_address(refanged_value)
            indicator_type = IndicatorType.IP_ADDRESS
        except ValueError:
            if re.fullmatch(r"https?://.+", refanged_value):
                indicator_type = IndicatorType.URL
            elif re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", refanged_value):
                indicator_type = IndicatorType.SENDER_EMAIL_ADDRESS
            elif re.fullmatch(r"[A-Za-z0-9.-]+\.[A-Za-z]{2,}", refanged_value):
                indicator_type = IndicatorType.DOMAIN_NAME
            else:
                indicator_type = None

    valid = indicator_type is not None
    reason = None if valid else "unsupported_indicator"

    action = None
    category = None
    generate_alert = None
    severity = None
    expiration_time = None
    if valid:
        if indicator_type in {IndicatorType.FILE_MD5, IndicatorType.FILE_SHA1, IndicatorType.FILE_SHA256}:
            action = Action.BLOCK_AND_REMEDIATE
        else:
            action = Action.BLOCK

        category = Category.MALWARE
        generate_alert = True
        severity = "High"
        expiration_time = "2099-12-31T23:59:59.0Z"

    return ParsedIOC(
        original_value=value,
        refanged_value=refanged_value,
        indicator_type=indicator_type,
        action=action,
        category=category,
        generate_alert=generate_alert,
        severity=severity,
        expiration_time=expiration_time,
        valid=valid,
        reason=reason,
    )
