from pathlib import Path
import csv
import io
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.routes.parse import IOCMetadata, ParseRequest, export_campaign_csv


def _read_csv_response(response):
    text = response.body.decode('utf-8-sig')
    return list(csv.reader(io.StringIO(text)))


def test_export_csv_endpoint_returns_expected_headers_and_file_response():
    response = export_campaign_csv(
        ParseRequest(
            raw_text='https://example.com',
            campaignName='Storm-123',
            iocMetadata=[
                IOCMetadata(value='https://example.com', campaignName='Storm-123', category='CommandAndControl')
            ],
        )
    )

    rows = _read_csv_response(response)
    headers = rows[0]

    assert response.status_code == 200
    assert response.headers['content-type'].startswith('text/csv')
    assert response.headers['content-disposition'] == 'attachment; filename=defender_iocs.csv'
    assert headers == [
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


def test_export_csv_endpoint_uses_empty_expiration_and_recommended_actions():
    response = export_campaign_csv(
        ParseRequest(
            raw_text='https://example.com',
            campaignName='Storm-123',
            iocMetadata=[
                IOCMetadata(value='https://example.com', campaignName='Storm-123', category='CommandAndControl')
            ],
        )
    )

    row = _read_csv_response(response)[1]
    assert row[2] == ''
    assert row[7] == ''


def test_export_csv_endpoint_uses_row_level_campaign_and_category_metadata():
    response = export_campaign_csv(
        ParseRequest(
            raw_text='https://example.com evil.com',
            iocMetadata=[
                IOCMetadata(value='https://example.com', campaignName='Campaign One', category='C2'),
                IOCMetadata(value='evil.com', campaignName='Campaign Two', category='credential access'),
            ],
        )
    )

    rows = _read_csv_response(response)
    data_rows = rows[1:]

    by_value = {row[1]: row for row in data_rows}

    assert by_value['https://example.com'][5] == 'Campaign One IOC'
    assert by_value['https://example.com'][6] == 'Indicators associated with Campaign One.'
    assert by_value['https://example.com'][9] == 'CommandAndControl'

    assert by_value['evil.com'][5] == 'Campaign Two IOC'
    assert by_value['evil.com'][6] == 'Indicators associated with Campaign Two.'
    assert by_value['evil.com'][9] == 'CredentialAccess'


def test_export_csv_endpoint_uses_per_file_campaign_names_without_title_concatenation():
    response = export_campaign_csv(
        ParseRequest(
            raw_text='https://first.example second.example',
            iocMetadata=[
                IOCMetadata(
                    value='https://first.example',
                    campaignName='Campaign A',
                    category='Execution',
                    sourceFile='file_a.csv',
                ),
                IOCMetadata(
                    value='second.example',
                    campaignName='Campaign B',
                    category='Discovery',
                    sourceFile='file_b.csv',
                ),
            ],
        )
    )

    rows = _read_csv_response(response)
    data_rows = rows[1:]
    by_value = {row[1]: row for row in data_rows}

    assert by_value['https://first.example'][5] == 'Campaign A IOC'
    assert by_value['https://first.example'][6] == 'Indicators associated with Campaign A.'
    assert by_value['second.example'][5] == 'Campaign B IOC'
    assert by_value['second.example'][6] == 'Indicators associated with Campaign B.'


def test_export_csv_endpoint_uses_manual_campaign_override_for_all_rows():
    response = export_campaign_csv(
        ParseRequest(
            raw_text='https://example.com evil.com',
            campaignName='Manual Campaign',
            iocMetadata=[
                IOCMetadata(value='https://example.com', campaignName='Campaign One', category='C2'),
                IOCMetadata(value='evil.com', campaignName='Campaign Two', category='CredentialAccess'),
            ],
        )
    )

    rows = _read_csv_response(response)
    data_rows = rows[1:]

    for row in data_rows:
        assert row[5] == 'Manual Campaign IOC'
        assert row[6] == 'Indicators associated with Manual Campaign.'


def test_export_csv_endpoint_falls_back_to_ioc_sweep_for_missing_campaign_name():
    response = export_campaign_csv(
        ParseRequest(
            raw_text='https://example.com',
            iocMetadata=[IOCMetadata(value='https://example.com', category='UnknownCategory')],
        )
    )

    row = _read_csv_response(response)[1]
    assert row[5] == 'General Threat Indicators'
    assert row[6] == 'Threat indicators manually submitted for blocking and investigation.'
    assert 'IOC Sweep' not in row[5]
    assert 'TSOC General IOC Collection' not in row[5]
    assert 'IOC Workbench' not in row[6]
    assert row[9] == 'Malware'


def test_export_csv_endpoint_uses_csv_campaign_name_when_manual_name_missing():
    response = export_campaign_csv(
        ParseRequest(
            raw_text='https://example.com',
            iocMetadata=[IOCMetadata(value='https://example.com', campaignName='CSV Campaign', category='Discovery')],
        )
    )

    row = _read_csv_response(response)[1]
    assert row[5] == 'CSV Campaign IOC'
    assert row[6] == 'Indicators associated with CSV Campaign.'


def test_export_csv_endpoint_row_category_overrides_manual_default_category():
    response = export_campaign_csv(
        ParseRequest(
            raw_text='https://example.com',
            defaultCategory='Ransomware',
            iocMetadata=[
                IOCMetadata(value='https://example.com', category='Discovery'),
            ],
        )
    )

    row = _read_csv_response(response)[1]
    assert row[9] == 'Discovery'


def test_export_csv_endpoint_uses_manual_default_category_when_row_category_missing():
    response = export_campaign_csv(
        ParseRequest(
            raw_text='https://example.com',
            defaultCategory='Ransomware',
            iocMetadata=[
                IOCMetadata(value='https://example.com', campaignName='Storm-1'),
            ],
        )
    )

    row = _read_csv_response(response)[1]
    assert row[9] == 'Ransomware'


def test_export_csv_endpoint_invalid_manual_default_category_falls_back_to_malware():
    response = export_campaign_csv(
        ParseRequest(
            raw_text='https://example.com',
            defaultCategory='InvalidCategoryValue',
            iocMetadata=[IOCMetadata(value='https://example.com')],
        )
    )

    row = _read_csv_response(response)[1]
    assert row[9] == 'Malware'


def test_export_csv_endpoint_mixed_source_metadata_excludes_email_rows():
    response = export_campaign_csv(
        ParseRequest(
            raw_text='https://from-csv.example 8.8.8.8 user@test.com',
            iocMetadata=[
                IOCMetadata(
                    value='https://from-csv.example',
                    campaignName='Campaign A',
                    category='Execution',
                    sourceFile='first.csv',
                ),
                IOCMetadata(
                    value='8.8.8.8',
                    campaignName='Campaign A',
                    category='C2',
                    sourceFile='second.xlsx',
                ),
                IOCMetadata(
                    value='user@test.com',
                    campaignName='Campaign A',
                    category='Discovery',
                    sourceFile='second.xlsx',
                ),
            ],
        )
    )

    rows = _read_csv_response(response)
    data_rows = rows[1:]

    assert len(data_rows) == 2
    assert all(row[0] != 'SenderEmailAddress' for row in data_rows)

    by_value = {row[1]: row for row in data_rows}
    assert by_value['https://from-csv.example'][5] == 'Campaign A IOC'
    assert by_value['https://from-csv.example'][9] == 'Execution'
    assert by_value['8.8.8.8'][5] == 'Campaign A IOC'
    assert by_value['8.8.8.8'][9] == 'CommandAndControl'


def test_export_csv_endpoint_sender_email_only_input_exports_no_data_rows():
    response = export_campaign_csv(
        ParseRequest(
            raw_text='user@test.com analyst@test.com',
            iocMetadata=[
                IOCMetadata(value='user@test.com', campaignName='Campaign A', category='Discovery'),
                IOCMetadata(value='analyst@test.com', campaignName='Campaign A', category='Discovery'),
            ],
        )
    )

    rows = _read_csv_response(response)
    assert len(rows) == 1


def test_export_csv_reference_style_content_excludes_labels_emails_and_port_notes():
    raw_text = "\n".join([
        "HASH",
        "1d865b3a5b803febddaa2a0c07099ceb",
        "1d0f8dd934cd975e0b70e1c2d8b1c5b2d438b25d",
        "a02f124c5ce4180bd130a62ee03262f399c33491de3aed36e0b15155ae4926c0",
        "URL",
        "hxxps://45[.]150[.]109[.]151[.]sslip[.]io:23088/app/js/jquery[.]min[.]js",
        "hxxps://194[.]213[.]18[.]133[.]sslip[.]io:23088/app/js/jquery[.]min[.]js",
        "hxxps://45[.]150[.]109[.]151[.]sslip[.]io On port 23088",
        "hxxps://194[.]213[.]18[.]133[.]sslip[.]io On port 23088",
        "hxxp://45[.]86[.]229[.]111/slw On port 8080",
        "IP",
        "45[.]150[.]109[.]151",
        "194[.]213[.]18[.]133",
        "45[.]86[.]229[.]111",
        "EMAIL",
        "jpcontreras@newfield[.]cl",
    ])

    response = export_campaign_csv(ParseRequest(raw_text=raw_text))
    rows = _read_csv_response(response)
    values = [row[1] for row in rows[1:]]

    assert 'HASH' not in values
    assert 'URL' not in values
    assert 'IP' not in values
    assert 'EMAIL' not in values
    assert 'On port 23088' not in values
    assert 'On port 8080' not in values
    assert not any('@' in value for value in values)
