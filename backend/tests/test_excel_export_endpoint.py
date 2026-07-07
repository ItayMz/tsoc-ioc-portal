from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.routes.parse import ParseRequest, export_campaign_excel


def test_export_excel_endpoint_returns_xlsx_file():
    response = export_campaign_excel(
        ParseRequest(raw_text="https://example.com", campaign_name="Lumma Stealer")
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert response.headers["content-disposition"] == "attachment; filename=defender_iocs.xlsx"
    assert response.body.startswith(b"PK")
