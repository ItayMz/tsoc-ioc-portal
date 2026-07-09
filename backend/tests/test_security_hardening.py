from io import StringIO
from pathlib import Path
import asyncio
import csv
import io
import sys

from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.exporters.defender_csv import sanitize_spreadsheet_cell, export_campaign_to_csv_bytes
from app.main import harden_request_handling
from app.models.campaign import Campaign
from app.models.ioc import ParsedIOC
from app.routes.parse import IOCMetadata, ParseRequest, export_campaign_csv, parse_bulk_iocs
from app.services.parser import MAX_RAW_TEXT_SIZE_BYTES, MAX_UPLOAD_FILE_SIZE_BYTES, prepare_text_from_upload


def _read_csv_bytes(payload: bytes):
    return list(csv.reader(StringIO(payload.decode('utf-8-sig'))))


def test_csv_formula_injection_sanitizes_campaign_title_fields():
    response = export_campaign_csv(
        ParseRequest(
            raw_text='https://example.com',
            campaignName='=Storm',
            iocMetadata=[IOCMetadata(value='https://example.com', campaignName='=Storm')],
        )
    )

    row = list(csv.reader(io.StringIO(response.body.decode('utf-8-sig'))))[1]
    assert row[5] == "'=Storm IOC"


def test_csv_formula_injection_sanitizes_formula_like_indicator_value():
    campaign = Campaign(
        indicators=[
            ParsedIOC(
                original_value='+calc',
                refanged_value='+calc',
                indicator_type='Url',
                action='Block',
                severity='High',
                generate_alert=True,
                valid=True,
            )
        ]
    )

    rows = _read_csv_bytes(export_campaign_to_csv_bytes(campaign))
    assert rows[1][1] == "'+calc"


def test_csv_formula_injection_sanitizes_formula_like_category_and_description():
    assert sanitize_spreadsheet_cell('@Description') == "'@Description"
    assert sanitize_spreadsheet_cell('-Category') == "'-Category"


def test_safe_values_remain_unchanged():
    assert sanitize_spreadsheet_cell('General Threat Indicators') == 'General Threat Indicators'
    assert sanitize_spreadsheet_cell('https://example.com') == 'https://example.com'


def test_oversized_raw_text_is_rejected():
    oversized_text = 'a' * (MAX_RAW_TEXT_SIZE_BYTES + 1)

    try:
        parse_bulk_iocs(ParseRequest(raw_text=oversized_text))
    except HTTPException as exc:
        assert exc.status_code == 413
        assert '5 MB limit' in str(exc.detail)
    else:
        raise AssertionError('Expected oversized raw_text to be rejected')


def test_file_larger_than_5mb_is_rejected():
    oversized_file = b'a' * (MAX_UPLOAD_FILE_SIZE_BYTES + 1)

    try:
        prepare_text_from_upload(oversized_file, 'oversized.txt')
    except ValueError as exc:
        assert '5 MB limit' in str(exc)
    else:
        raise AssertionError('Expected oversized file to be rejected')


def test_more_than_10_uploaded_files_is_rejected():
    metadata = [
        IOCMetadata(value='https://example.com', sourceFile=f'file_{index}.csv')
        for index in range(11)
    ]

    try:
        parse_bulk_iocs(ParseRequest(raw_text='https://example.com', iocMetadata=metadata))
    except HTTPException as exc:
        assert exc.status_code == 400
        assert 'maximum of 10 files' in str(exc.detail)
    else:
        raise AssertionError('Expected too many uploaded files to be rejected')


def test_invalid_utf8_is_rejected_gracefully():
    try:
        prepare_text_from_upload(b'\xff\xfe\x00', 'invalid.csv')
    except ValueError as exc:
        assert 'UTF-8' in str(exc)
    else:
        raise AssertionError('Expected invalid UTF-8 to be rejected')


def test_unsupported_file_type_is_rejected_gracefully():
    try:
        prepare_text_from_upload(b'https://example.com', 'payload.exe')
    except ValueError as exc:
        assert 'Unsupported file type' in str(exc)
    else:
        raise AssertionError('Expected unsupported file type to be rejected')


def _make_request(method='GET', path='/', body=b'', scheme='http'):
    async def receive():
        return {'type': 'http.request', 'body': body, 'more_body': False}

    scope = {
        'type': 'http',
        'http_version': '1.1',
        'method': method,
        'path': path,
        'raw_path': path.encode('utf-8'),
        'root_path': '',
        'scheme': scheme,
        'query_string': b'',
        'headers': [(b'host', b'testserver'), (b'content-length', str(len(body)).encode('ascii'))],
        'client': ('127.0.0.1', 50000),
        'server': ('testserver', 80),
    }
    return Request(scope, receive)


def test_security_headers_exist_on_http_responses():
    request = _make_request()

    async def call_next(_request):
        return JSONResponse({'status': 'ok'})

    response = asyncio.run(harden_request_handling(request, call_next))

    assert response.headers['x-content-type-options'] == 'nosniff'
    assert response.headers['x-frame-options'] == 'DENY'
    assert response.headers['referrer-policy'] == 'no-referrer'
    assert "default-src 'none'" in response.headers['content-security-policy']
    assert 'strict-transport-security' not in response.headers


def test_security_headers_include_hsts_for_https_requests():
    request = _make_request(scheme='https')

    async def call_next(_request):
        return JSONResponse({'status': 'ok'})

    response = asyncio.run(harden_request_handling(request, call_next))

    assert response.headers['strict-transport-security'] == 'max-age=31536000; includeSubDomains'


def test_total_request_size_limit_rejects_oversized_payload():
    oversized_body = b'a' * (21 * 1024 * 1024)
    request = _make_request(method='POST', path='/parse', body=oversized_body)

    async def call_next(_request):
        return JSONResponse({'status': 'ok'})

    response = asyncio.run(harden_request_handling(request, call_next))

    assert response.status_code == 413
    assert '20 MB' in response.body.decode('utf-8')
