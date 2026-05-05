import base64
import csv
import json
import os
import sys
from io import StringIO
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

# Ensure local module imports work when this file is deployed as a Lambda function.
sys.path.insert(0, os.path.dirname(__file__))

from enrich import (
    MAX_WORKERS,
    BATCH_SIZE,
    REQUIRED_COLUMNS,
    OUTPUT_COLUMNS,
    process_row,
    logger,
)


def get_csv_bytes_from_event(event):
    body = event.get("body")
    if body is None:
        raise ValueError("Request body is required.")

    if event.get("isBase64Encoded"):
        return base64.b64decode(body)

    if isinstance(body, str):
        stripped = body.strip()
        if stripped.startswith("{") and stripped.endswith("}"):
            try:
                payload = json.loads(body)
                if isinstance(payload, dict) and "csv" in payload:
                    csv_payload = payload["csv"]
                    if isinstance(csv_payload, str):
                        return csv_payload.encode("utf-8")
            except json.JSONDecodeError:
                pass
        return body.encode("utf-8")

    raise ValueError("Unsupported request body type.")


def parse_csv_rows(csv_bytes):
    try:
        text = csv_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = csv_bytes.decode("utf-8", errors="replace")

    reader = csv.DictReader(StringIO(text))
    rows = list(reader)
    if not reader.fieldnames:
        raise ValueError("CSV must include a header row.")

    return rows, reader.fieldnames


def build_dynamic_output_columns(input_columns):
    dynamic_output_cols = [col for col in OUTPUT_COLUMNS if col in input_columns]
    enrichment_fields = [
        "email",
        "email_primary",
        "instagram",
        "twitter",
        "linkedin_company",
        "linkedin_ceo",
        "linkedin_founder",
        "facebook",
        "youtube",
        "phone_primary",
        "contact_page_found",
        "social_media_score",
        "lead_quality_score",
        "contact_confidence",
        "best_contact_method",
        "decision_maker_found",
        "tech_stack_detected",
        "company_size_indicator",
    ]

    for new_field in enrichment_fields:
        if new_field not in dynamic_output_cols:
            dynamic_output_cols.append(new_field)

    return dynamic_output_cols


def process_rows(rows):
    results = []
    total_leads = len(rows)

    logger.info(f"Lambda enrichment start: {total_leads} leads")

    for batch_start in range(0, total_leads, BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, total_leads)
        batch = rows[batch_start:batch_end]

        logger.info(f"Processing batch {batch_start // BATCH_SIZE + 1}: rows {batch_start + 1}-{batch_end}")

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_to_row = {executor.submit(process_row, row.copy()): row for row in batch}
            for future in as_completed(future_to_row):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as exc:
                    logger.error(f"Error processing row: {exc}")

    logger.info(f"Lambda enrichment complete: {len(results)} results")
    return results


def write_csv_bytes(results, fieldnames):
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, restval="")
    writer.writeheader()
    for row in results:
        filtered_row = {k: v for k, v in row.items() if k in fieldnames}
        writer.writerow(filtered_row)
    return output.getvalue().encode("utf-8")


def build_lambda_response(status_code, body, headers=None, is_base64=False):
    response = {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
        "body": body,
        "isBase64Encoded": is_base64,
    }
    if headers:
        response["headers"].update(headers)
    return response


def lambda_handler(event, context):
    try:
        csv_bytes = get_csv_bytes_from_event(event)
        rows, input_columns = parse_csv_rows(csv_bytes)

        missing_cols = [col for col in REQUIRED_COLUMNS if col not in input_columns]
        if missing_cols:
            return build_lambda_response(
                400,
                json.dumps({"error": f"Missing required column(s): {missing_cols}"}),
                {"Content-Type": "application/json"},
                is_base64=False,
            )

        output_columns = build_dynamic_output_columns(input_columns)
        results = process_rows(rows)

        if not results:
            return build_lambda_response(
                400,
                json.dumps({"error": "No results produced from enrichment."}),
                {"Content-Type": "application/json"},
                is_base64=False,
            )

        csv_output = write_csv_bytes(results, output_columns)
        filename = f"enriched_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        query_params = event.get("queryStringParameters") or {}
        if query_params.get("filename"):
            filename = query_params.get("filename")

        headers = {
            "Content-Type": "text/csv",
            "Content-Disposition": f"attachment; filename=\"{filename}\"",
        }
        return build_lambda_response(
            200,
            base64.b64encode(csv_output).decode("utf-8"),
            headers,
            is_base64=True,
        )

    except ValueError as exc:
        logger.error(str(exc))
        return build_lambda_response(
            400,
            json.dumps({"error": str(exc)}),
            {"Content-Type": "application/json"},
            is_base64=False,
        )
    except Exception as exc:
        logger.exception("Lambda handler failed")
        return build_lambda_response(
            500,
            json.dumps({"error": "Internal server error."}),
            {"Content-Type": "application/json"},
            is_base64=False,
        )
