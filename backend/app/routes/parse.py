from fastapi import APIRouter, Response
from pydantic import BaseModel

from app.exporters.defender_excel import export_campaign_to_excel_bytes
from app.models.campaign import Campaign, CampaignStatistics
from app.models.ioc import ParsedIOC
from app.services.parser import parse_bulk_text

router = APIRouter()


class ParseRequest(BaseModel):
    raw_text: str
    campaign_name: str | None = None
    source_email_text: str | None = None


class ParseResponse(BaseModel):
    indicators: list[ParsedIOC]
    total_count: int
    valid_count: int
    invalid_count: int
    counts_by_type: dict[str, int]
    title: str
    description: str
    recommended_actions: str


def _build_campaign_metadata(campaign_name: str | None) -> tuple[str, str, str]:
    if campaign_name and campaign_name.strip():
        name = campaign_name.strip()
        return (
            f"Block {name} Indicators",
            f"Indicators associated with the {name} campaign.",
            "Block the listed indicators and investigate any historical communication.",
        )

    return (
        "Block Malicious Indicators",
        "Indicators associated with a reported malicious campaign.",
        "Block the listed indicators and investigate any historical communication.",
    )


@router.post("/parse", response_model=ParseResponse)
def parse_bulk_iocs(payload: ParseRequest) -> ParseResponse:
    indicators = parse_bulk_text(payload.raw_text)
    campaign = build_campaign(payload, indicators)

    return ParseResponse(
        indicators=indicators,
        total_count=campaign.statistics.total_count,
        valid_count=campaign.statistics.valid_count,
        invalid_count=campaign.statistics.invalid_count,
        counts_by_type=campaign.statistics.counts_by_type,
        title=campaign.title,
        description=campaign.description,
        recommended_actions=campaign.recommended_actions,
    )


@router.post("/export/excel")
def export_campaign_excel(payload: ParseRequest) -> Response:
    indicators = parse_bulk_text(payload.raw_text)
    campaign = build_campaign(payload, indicators)
    workbook_bytes = export_campaign_to_excel_bytes(campaign)

    return Response(
        content=workbook_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=defender_iocs.xlsx"},
    )


def build_campaign(payload: ParseRequest, indicators: list[ParsedIOC]) -> Campaign:
    valid_count = sum(1 for indicator in indicators if indicator.valid)
    counts_by_type: dict[str, int] = {}

    for indicator in indicators:
        if not indicator.valid or indicator.indicator_type is None:
            continue
        counts_by_type[indicator.indicator_type.value] = counts_by_type.get(indicator.indicator_type.value, 0) + 1

    title, description, recommended_actions = _build_campaign_metadata(payload.campaign_name)

    return Campaign(
        campaign_name=payload.campaign_name,
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
