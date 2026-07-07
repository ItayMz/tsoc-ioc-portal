from fastapi import APIRouter
from pydantic import BaseModel

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
    valid_count = sum(1 for indicator in indicators if indicator.valid)
    counts_by_type: dict[str, int] = {}

    for indicator in indicators:
        if not indicator.valid or indicator.indicator_type is None:
            continue
        counts_by_type[indicator.indicator_type.value] = counts_by_type.get(indicator.indicator_type.value, 0) + 1

    title, description, recommended_actions = _build_campaign_metadata(payload.campaign_name)

    return ParseResponse(
        indicators=indicators,
        total_count=len(indicators),
        valid_count=valid_count,
        invalid_count=len(indicators) - valid_count,
        counts_by_type=counts_by_type,
        title=title,
        description=description,
        recommended_actions=recommended_actions,
    )
