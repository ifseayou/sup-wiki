#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

import pdfplumber


REPO_ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = REPO_ROOT / ".cache" / "icf-sup-world-ranking-2025"
PDF_DIR = CACHE_DIR / "pdfs"
OUTPUT_PATH = CACHE_DIR / "parsed" / "standings.json"

GROUPS = [
    {
        "code": "icf_distance_men",
        "label": "ICF Distance Men",
        "discipline": "distance",
        "discipline_label": "Distance",
        "gender": "men",
        "pdf_file": "distance-men.pdf",
        "pdf_url": "https://www.canoeicf.com/sites/default/files/sup_wr_10112025_long_distance_men.pdf",
    },
    {
        "code": "icf_distance_women",
        "label": "ICF Distance Women",
        "discipline": "distance",
        "discipline_label": "Distance",
        "gender": "women",
        "pdf_file": "distance-women.pdf",
        "pdf_url": "https://www.canoeicf.com/sites/default/files/sup_wr_10112025_long_distance_women.pdf",
    },
    {
        "code": "icf_technical_men",
        "label": "ICF Technical Men",
        "discipline": "technical",
        "discipline_label": "Technical",
        "gender": "men",
        "pdf_file": "technical-men.pdf",
        "pdf_url": "https://www.canoeicf.com/sites/default/files/sup_wr_10112025_technical_men.pdf",
    },
    {
        "code": "icf_technical_women",
        "label": "ICF Technical Women",
        "discipline": "technical",
        "discipline_label": "Technical",
        "gender": "women",
        "pdf_file": "technical-women.pdf",
        "pdf_url": "https://www.canoeicf.com/sites/default/files/sup_wr_10112025_technical_women.pdf",
    },
    {
        "code": "icf_sprint_men",
        "label": "ICF Sprint Men",
        "discipline": "sprint",
        "discipline_label": "Sprint",
        "gender": "men",
        "pdf_file": "sprint-men.pdf",
        "pdf_url": "https://www.canoeicf.com/sites/default/files/sup_wr_10112025_sprint_men.pdf",
    },
    {
        "code": "icf_sprint_women",
        "label": "ICF Sprint Women",
        "discipline": "sprint",
        "discipline_label": "Sprint",
        "gender": "women",
        "pdf_file": "sprint-women.pdf",
        "pdf_url": "https://www.canoeicf.com/sites/default/files/sup_wr_10112025_sprint_women.pdf",
    },
]


def number_or_none(value):
    raw = str(value or "").strip()
    if not raw or raw == "-":
        return None
    try:
        return round(float(raw), 3)
    except ValueError:
        return None


def int_or_none(value):
    number = number_or_none(value)
    return int(number) if number is not None else None


def parse_group(group):
    pdf_path = PDF_DIR / group["pdf_file"]
    if not pdf_path.exists():
        raise FileNotFoundError(f"Missing PDF: {pdf_path}")

    records = []
    extracted_tables = 0
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            for table in page.extract_tables() or []:
                if not table or len(table) < 2:
                    continue
                extracted_tables += 1
                header = [str(cell or "").strip() for cell in table[0]]
                event_names = [item for item in header[2:-1] if item]
                for raw_row in table[1:]:
                    row = [(str(cell).strip() if cell is not None else "") for cell in raw_row]
                    if len(row) < len(header):
                        row.extend([""] * (len(header) - len(row)))
                    rank = int_or_none(row[0])
                    name = row[1].strip()
                    total_points = number_or_none(row[-1])
                    if rank is None or not name or total_points is None or total_points <= 0:
                        continue
                    event_points = []
                    for event_name, point_value in zip(event_names, row[2:-1]):
                        points = number_or_none(point_value)
                        if points is None or points <= 0:
                            continue
                        event_points.append({"event_name": event_name, "points": points})

                    if group["discipline"] == "distance":
                        endurance_points, sprint_points, technical_points = total_points, None, None
                    elif group["discipline"] == "sprint":
                        endurance_points, sprint_points, technical_points = None, total_points, None
                    else:
                        endurance_points, sprint_points, technical_points = None, None, total_points

                    detail_text = "\n".join(f"{item['event_name']}：{item['points']}" for item in event_points)
                    source_record_id = f"{group['code']}:{rank}:{name.lower().replace(' ', '-')}"
                    records.append(
                        {
                            "source_record_id": source_record_id[:80],
                            "source_token": f"{group['code']}:{name.lower().replace(' ', '')}"[:120],
                            "year": 2025,
                            "group_code": group["code"],
                            "group_name": group["label"],
                            "rank_position": rank,
                            "athlete_name_snapshot": name,
                            "total_points": total_points,
                            "endurance_points": endurance_points,
                            "sprint_points": sprint_points,
                            "technical_points": technical_points,
                            "base_detail_text": detail_text,
                            "adjustment_detail_text": "",
                            "breakdowns": event_points,
                            "raw_json": {
                                "rank": rank,
                                "name": name,
                                "discipline": group["discipline_label"],
                                "gender": group["gender"],
                                "event_points": event_points,
                                "sum": total_points,
                                "pdf_url": group["pdf_url"],
                                "source_locator": f"page:{page_index}",
                                "raw_row": row,
                            },
                        }
                    )

    source = {
        "source_key": f"icf-2025-sup-wr-{group['discipline']}-{group['gender']}",
        "year": 2025,
        "title": f"2025 ICF SUP World Ranking List - {group['discipline_label']} {group['gender'].title()}",
        "source_url": group["pdf_url"],
        "form_token": "icf-2025-sup-world-ranking",
        "open_search_id": group["code"],
        "parser_name": "parse-icf-sup-world-ranking-2025.py",
        "group_code": group["code"],
        "group_name": group["label"],
        "discipline": group["discipline"],
        "gender": group["gender"],
        "pdf_file": group["pdf_file"],
        "pdf_url": group["pdf_url"],
        "extracted_tables": extracted_tables,
        "records": len(records),
    }
    return source, records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(OUTPUT_PATH))
    args = parser.parse_args()

    sources = []
    records = []
    for group in GROUPS:
        source, group_records = parse_group(group)
        sources.append(source)
        records.extend(group_records)
        print(f"{source['group_name']}: {len(group_records)} rows")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "metadata": {
            "year": 2025,
            "title": "2025 ICF SUP World Ranking List",
            "parser": "parse-icf-sup-world-ranking-2025.py",
            "record_count": len(records),
            "source_count": len(sources),
        },
        "sources": sources,
        "records": records,
    }
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output_path} ({len(records)} rows)")


if __name__ == "__main__":
    main()
