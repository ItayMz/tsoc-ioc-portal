from collections import Counter

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.enums.indicator_type import IndicatorType
from app.exporters.defender_csv import export_campaign_to_csv_bytes
from app.exporters.defender_excel import export_campaign_to_excel_bytes
from app.models.campaign import Campaign, CampaignStatistics
from app.models.ioc import ParsedIOC
from app.services.kql_builder import build_kql_queries
from app.services.parser import parse_bulk_text, validate_raw_text_size

router = APIRouter()
MAX_UPLOAD_FILES = 10


class IOCMetadata(BaseModel):
    value: str
    campaignName: str | None = None
    category: str | None = None
    sourceFile: str | None = None


class ParseRequest(BaseModel):
    raw_text: str
    campaign_name: str | None = None
    campaignName: str | None = None
    defaultCategory: str | None = None
    iocMetadata: list[IOCMetadata] | None = None
    source_email_text: str | None = None
    lookbackDays: int | None = None


class ProcessingSummary(BaseModel):
    processed: int
    md5: int
    sha1: int
    sha256: int
    ipv4: int
    ipv6: int
    domains: int
    urls: int
    duplicatesRemoved: int
    queriesGenerated: int


class ParseResponse(BaseModel):
    indicators: list[ParsedIOC]
    total_count: int
    valid_count: int
    invalid_count: int
    counts_by_type: dict[str, int]
    title: str
    description: str
    recommended_actions: str
    summary: ProcessingSummary
    kqlQueries: dict[str, dict[str, object] | None]


def _build_campaign_metadata(campaign_name: str | None) -> tuple[str, str, str]:
    if campaign_name and campaign_name.strip():
        name = campaign_name.strip()
        return (
            f"{name} IOC",
            f"Indicators associated with {name}.",
            "",
        )

    return (
        "IOC Sweep",
        "Indicators submitted for IOC sweep.",
        "",
    )


def _resolve_campaign_name(payload: ParseRequest) -> str | None:
    manual_name = (payload.campaignName or '').strip()
    if manual_name:
        return manual_name

    legacy_name = (payload.campaign_name or '').strip()
    if legacy_name:
        return legacy_name

    campaign_values = [
        str(row.campaignName).strip()
        for row in (payload.iocMetadata or [])
        if row.campaignName and str(row.campaignName).strip()
    ]
    if campaign_values:
        most_common = Counter(campaign_values).most_common(1)[0][0]
        return most_common

    return None


def _resolve_manual_campaign_name(payload: ParseRequest) -> str | None:
    manual_name = (payload.campaignName or '').strip()
    if manual_name:
        return manual_name

    legacy_name = (payload.campaign_name or '').strip()
    if legacy_name:
        return legacy_name

    return None


def _validate_payload_limits(payload: ParseRequest) -> None:
    try:
        validate_raw_text_size(payload.raw_text)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc

    source_files = {
        str(row.sourceFile).strip()
        for row in (payload.iocMetadata or [])
        if row.sourceFile and str(row.sourceFile).strip()
    }
    if len(source_files) > MAX_UPLOAD_FILES:
        raise HTTPException(
            status_code=400,
            detail="Upload exceeds the maximum of 10 files per request.",
        )


def _parse_indicators_from_payload(payload: ParseRequest) -> list[ParsedIOC]:
    _validate_payload_limits(payload)
    try:
        return parse_bulk_text(payload.raw_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/parse", response_model=ParseResponse)
def parse_bulk_iocs(payload: ParseRequest) -> ParseResponse:
    indicators = _parse_indicators_from_payload(payload)
    campaign = build_campaign(payload, indicators)
    grouped_iocs = _group_iocs_by_type(indicators)
    kql_queries = build_kql_queries(grouped_iocs, payload.lookbackDays)
    summary = _build_processing_summary(indicators, grouped_iocs, kql_queries)

    return ParseResponse(
        indicators=indicators,
        total_count=campaign.statistics.total_count,
        valid_count=campaign.statistics.valid_count,
        invalid_count=campaign.statistics.invalid_count,
        counts_by_type=campaign.statistics.counts_by_type,
        title=campaign.title,
        description=campaign.description,
        recommended_actions=campaign.recommended_actions,
        summary=summary,
        kqlQueries=kql_queries,
    )


@router.post("/export/excel")
def export_campaign_excel(payload: ParseRequest) -> Response:
    indicators = _parse_indicators_from_payload(payload)
    campaign = build_campaign(payload, indicators)
    workbook_bytes = export_campaign_to_excel_bytes(campaign)

    return Response(
        content=workbook_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=defender_iocs.xlsx"},
    )


@router.post("/export/csv")
def export_campaign_csv(payload: ParseRequest) -> Response:
    indicators = _parse_indicators_from_payload(payload)
    campaign = build_campaign(payload, indicators)
    csv_bytes = export_campaign_to_csv_bytes(
        campaign,
        ioc_metadata=[row.model_dump() for row in (payload.iocMetadata or [])],
        manual_campaign_name=_resolve_manual_campaign_name(payload),
        default_category=payload.defaultCategory,
    )

    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=defender_iocs.csv"},
    )


def _build_processing_summary(
    indicators: list[ParsedIOC],
    grouped_iocs: dict[str, list[ParsedIOC]],
    kql_queries: dict[str, dict[str, object] | None],
) -> ProcessingSummary:
    valid_indicators = [indicator for indicator in indicators if indicator.valid]
    duplicates_removed = len(indicators) - len(valid_indicators)
    queries_generated = sum(1 for query in kql_queries.values() if query is not None)

    return ProcessingSummary(
        processed=len(indicators),
        md5=len(grouped_iocs["md5"]),
        sha1=len(grouped_iocs["sha1"]),
        sha256=len(grouped_iocs["sha256"]),
        ipv4=len(grouped_iocs["ipv4"]),
        ipv6=len(grouped_iocs["ipv6"]),
        domains=len(grouped_iocs["domains"]),
        urls=len(grouped_iocs["urls"]),
        duplicatesRemoved=duplicates_removed,
        queriesGenerated=queries_generated,
    )


def _group_iocs_by_type(indicators: list[ParsedIOC]) -> dict[str, list[ParsedIOC]]:
    grouped: dict[str, list[ParsedIOC]] = {
        "md5": [],
        "sha1": [],
        "sha256": [],
        "ipv4": [],
        "ipv6": [],
        "domains": [],
        "urls": [],
    }

    for indicator in indicators:
        if not indicator.valid or indicator.indicator_type is None:
            continue

        if indicator.indicator_type is IndicatorType.FILE_MD5:
            grouped["md5"].append(indicator)
        elif indicator.indicator_type is IndicatorType.FILE_SHA1:
            grouped["sha1"].append(indicator)
        elif indicator.indicator_type is IndicatorType.FILE_SHA256:
            grouped["sha256"].append(indicator)
        elif indicator.indicator_type is IndicatorType.IP_ADDRESS:
            if indicator.refanged_value:
                try:
                    import ipaddress

                    if isinstance(ipaddress.ip_address(indicator.refanged_value), ipaddress.IPv4Address):
                        grouped["ipv4"].append(indicator)
                    else:
                        grouped["ipv6"].append(indicator)
                except ValueError:
                    pass
        elif indicator.indicator_type is IndicatorType.DOMAIN_NAME:
            grouped["domains"].append(indicator)
        elif indicator.indicator_type is IndicatorType.URL:
            grouped["urls"].append(indicator)

    return grouped


def build_campaign(payload: ParseRequest, indicators: list[ParsedIOC]) -> Campaign:
    valid_count = sum(1 for indicator in indicators if indicator.valid)
    counts_by_type: dict[str, int] = {}
    campaign_name = _resolve_campaign_name(payload)

    for indicator in indicators:
        if not indicator.valid or indicator.indicator_type is None:
            continue
        counts_by_type[indicator.indicator_type.value] = counts_by_type.get(indicator.indicator_type.value, 0) + 1

    title, description, recommended_actions = _build_campaign_metadata(campaign_name)

    return Campaign(
        campaign_name=campaign_name,
        source_email_text=payload.source_email_text,
        title=title,
        description=description,
        recommended_actions=recommended_actions,
        indicators=indicators,
        statistics=CampaignStatistics(
            total_count=len(indicators),
            valid_count=valid_count,
            invalid_count=len(indicators) - valid_count,
            counts_by_type=counts_by_type,
        ),
    )
