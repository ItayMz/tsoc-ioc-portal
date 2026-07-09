import csv
from collections import Counter, defaultdict
from enum import Enum
from io import StringIO

from app.enums.category import Category
from app.models.campaign import Campaign
from app.services.parser import parse_ioc

HEADERS = [
    'IndicatorType',
    'IndicatorValue',
    'ExpirationTime',
    'Action',
    'Severity',
    'Title',
    'Description',
    'RecommendedActions',
    'RbacGroups',
    'Category',
    'MitreTechniques',
    'GenerateAlert',
]

CATEGORY_ALIASES = {
    'collection': Category.COLLECTION,
    'commandandcontrol': Category.COMMAND_AND_CONTROL,
    'command and control': Category.COMMAND_AND_CONTROL,
    'c2': Category.COMMAND_AND_CONTROL,
    'credentialaccess': Category.CREDENTIAL_ACCESS,
    'credential access': Category.CREDENTIAL_ACCESS,
    'defenseevasion': Category.DEFENSE_EVASION,
    'defense evasion': Category.DEFENSE_EVASION,
    'discovery': Category.DISCOVERY,
    'execution': Category.EXECUTION,
    'exfiltration': Category.EXFILTRATION,
    'exploit': Category.EXPLOIT,
    'initialaccess': Category.INITIAL_ACCESS,
    'initial access': Category.INITIAL_ACCESS,
    'lateralmovement': Category.LATERAL_MOVEMENT,
    'lateral movement': Category.LATERAL_MOVEMENT,
    'malware': Category.MALWARE,
    'persistence': Category.PERSISTENCE,
    'privilegeescalation': Category.PRIVILEGE_ESCALATION,
    'privilege escalation': Category.PRIVILEGE_ESCALATION,
    'ransomware': Category.RANSOMWARE,
    'suspiciousactivity': Category.SUSPICIOUS_ACTIVITY,
    'suspicious activity': Category.SUSPICIOUS_ACTIVITY,
    'suspicious': Category.SUSPICIOUS_ACTIVITY,
    'unwantedsoftware': Category.UNWANTED_SOFTWARE,
    'unwanted software': Category.UNWANTED_SOFTWARE,
}

FORMULA_PREFIX_CHARACTERS = ("=", "+", "-", "@", "\t", "\r", "\n")


def sanitize_spreadsheet_cell(value: str) -> str:
    if value.startswith(FORMULA_PREFIX_CHARACTERS):
        return f"'{value}"
    return value


def _to_csv_value(value: object) -> str:
    if value is None:
        return ''
    if isinstance(value, Enum):
        return sanitize_spreadsheet_cell(str(value.value))
    return sanitize_spreadsheet_cell(str(value))


def normalize_category(raw_category: str | None) -> Category:
    if raw_category is None:
        return Category.MALWARE

    normalized = str(raw_category).strip()
    if not normalized:
        return Category.MALWARE

    direct = {category.value.lower(): category for category in Category}
    lowered = normalized.lower()
    if lowered in direct:
        return direct[lowered]

    compact = lowered.replace('_', ' ').replace('-', ' ')
    alias_key = ' '.join(compact.split())
    if alias_key in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[alias_key]

    if alias_key.replace(' ', '') in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[alias_key.replace(' ', '')]

    return Category.MALWARE


def build_row_title(campaign_name: str | None) -> str:
    if campaign_name and campaign_name.strip():
        return f"{campaign_name.strip()} IOC"
    return 'General Threat Indicators'


def build_row_description(campaign_name: str | None) -> str:
    if campaign_name and campaign_name.strip():
        return f"Indicators associated with {campaign_name.strip()}."
    return 'Threat indicators manually submitted for blocking and investigation.'


def _best_value(values: list[str]) -> str | None:
    if not values:
        return None

    counts = Counter(values)
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[0][0]


def _build_metadata_lookup(ioc_metadata: list[dict[str, str | None]] | None) -> tuple[dict[tuple[str, str], dict[str, list[str]]], str | None]:
    per_ioc: dict[tuple[str, str], dict[str, list[str]]] = defaultdict(lambda: {'campaign': [], 'category': []})
    all_campaigns: list[str] = []

    for row in ioc_metadata or []:
        value = str(row.get('value') or '').strip()
        if not value:
            continue

        parsed = parse_ioc(value)
        if not parsed.valid or parsed.indicator_type is None:
            continue

        key = (parsed.indicator_type.value, parsed.refanged_value.lower())
        campaign_name = str(row.get('campaignName') or '').strip()
        category_value = str(row.get('category') or '').strip()

        if campaign_name:
            per_ioc[key]['campaign'].append(campaign_name)
            all_campaigns.append(campaign_name)

        if category_value:
            per_ioc[key]['category'].append(category_value)

    return per_ioc, _best_value(all_campaigns)


def export_campaign_to_csv_bytes(
    campaign: Campaign,
    ioc_metadata: list[dict[str, str | None]] | None = None,
    manual_campaign_name: str | None = None,
    default_category: str | None = None,
) -> bytes:
    metadata_lookup, global_detected_campaign = _build_metadata_lookup(ioc_metadata)
    manual_campaign = str(manual_campaign_name or '').strip() or None

    output = StringIO(newline='')
    writer = csv.writer(output)
    writer.writerow(HEADERS)

    for indicator in campaign.indicators:
        if not indicator.valid or indicator.indicator_type is None:
            continue

        key = (indicator.indicator_type.value, indicator.refanged_value.lower())
        metadata_bucket = metadata_lookup.get(key, {'campaign': [], 'category': []})

        row_category = _best_value(metadata_bucket['category'])
        category = normalize_category(row_category if row_category else default_category)
        campaign_name = manual_campaign or _best_value(metadata_bucket['campaign']) or global_detected_campaign

        writer.writerow(
            [
                _to_csv_value(indicator.indicator_type),
                _to_csv_value(indicator.refanged_value),
                '',
                _to_csv_value(indicator.action),
                _to_csv_value(indicator.severity),
                _to_csv_value(build_row_title(campaign_name)),
                _to_csv_value(build_row_description(campaign_name)),
                '',
                '',
                _to_csv_value(category),
                '',
                _to_csv_value(indicator.generate_alert),
            ]
        )

    return output.getvalue().encode('utf-8-sig')
