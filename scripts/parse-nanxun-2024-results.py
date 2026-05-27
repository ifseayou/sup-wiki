#!/usr/bin/env python3
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_ID = 232
EVENT_NAME = "2024第六届南浔古镇桨板公开赛（水上运动户外运动周）"
SOURCE_URL = "/result-books/20240615期浙江南浔桨板公开赛/长程赛成人组成绩公告.pdf"
SOURCE_ID = 290


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalize_lines(text: str) -> list[str]:
    raw_lines = [clean(line) for line in text.splitlines() if clean(line)]
    lines: list[str] = []
    index = 0
    while index < len(raw_lines):
        line = raw_lines[index]
        if re.match(r"^\d{1,3}\s+\D+$", line) and index + 1 < len(raw_lines):
            next_line = raw_lines[index + 1]
            if re.match(r"^[A-Za-z].*\s+\d{2,3}\s+4-\d\s+", next_line):
                lines.append(f"{line} {next_line}")
                index += 2
                continue
        lines.append(line)
        index += 1
    return lines


def parse_time_to_seconds(value: str) -> float | None:
    text = clean(value)
    if not text or text == "无成绩":
        return None
    match = re.match(r"^(?:(\d+):)?(\d+)′(\d+)″(\d+)$", text)
    if not match:
        return None
    hours, minutes, seconds, hundredths = match.groups()
    return (int(hours or 0) * 3600) + (int(minutes) * 60) + int(seconds) + int(hundredths) / 100


def parse_pdf(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    results: list[dict[str, Any]] = []
    status_sequences: dict[str, int] = defaultdict(int)

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        for line in normalize_lines(text):
            if (
                not line
                or line.startswith("名次 ")
                or line.startswith("湖州·南浔")
                or line.startswith("第六届")
                or line.startswith("古镇长程赛")
                or line.startswith("成绩公告")
            ):
                continue

            match = re.match(
                r"^(?:(\d{1,3})\s+)?(.+?)\s+(\d{2,3})\s+(4-\d)\s+([^ ]+)\s+(.+?)(?:\s+(.*))?$",
                line,
            )
            if not match:
                raise ValueError(f"Unparsed row on page {page_number}: {line}")

            rank_raw, name, bib_number, heat, group_name, finish_time, note = match.groups()
            name = clean(name)
            finish_time = clean(finish_time)
            note = clean(note)
            if finish_time == "无成绩":
                status_sequences[group_name] += 1
                rank = 9000 + status_sequences[group_name]
                status_code = "NO_RESULT"
                status_note = "无成绩"
                result_label = note or "无成绩"
            else:
                rank = int(rank_raw or 0)
                if rank <= 0:
                    raise ValueError(f"Missing rank on page {page_number}: {line}")
                status_code = None
                status_note = None
                result_label = note or None

            results.append(
                {
                    "athlete_name_snapshot": name,
                    "bib_number": bib_number,
                    "gender_group": group_name,
                    "discipline": "古镇长程赛",
                    "board_class": None,
                    "round_label": "决赛",
                    "rank_position": rank,
                    "result_label": result_label,
                    "finish_time": finish_time,
                    "result_status_code": status_code,
                    "result_status_note": status_note,
                    "time_seconds": parse_time_to_seconds(finish_time),
                    "team_name": "个人",
                    "team_members": [],
                    "points": None,
                    "source_locator": f"page:{page_number}",
                    "source_note": f"组次:{heat}",
                    "parse_confidence": 0.99,
                    "review_status": "confirmed",
                }
            )

    return {
        "event": {
            "event_id": EVENT_ID,
            "name": EVENT_NAME,
            "start_date": "2024-06-15",
            "end_date": "2024-06-15",
            "province": "浙江省",
            "city": "湖州市",
            "venue": "南浔古镇",
            "event_status": "completed",
            "result_status": "extended_complete",
        },
        "source": {
            "source_id": SOURCE_ID,
            "original_path": str(path),
            "file_name": path.name,
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "parser_name": "parse-nanxun-2024-results.py",
            "parser_status": "parsed",
            "parser_note": "南浔长程赛成人组成绩公告重解析，包含无成绩状态行。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "local_result_book",
                "relative_path": "20240615期浙江南浔桨板公开赛/长程赛成人组成绩公告.pdf",
                "event_key": "nanxun-2024-long-distance-adult",
                "no_result_rows": sum(1 for row in results if row["result_status_code"] == "NO_RESULT"),
            },
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("-o", "--output", type=Path, default=Path(".cache/nanxun-2024-results.json"))
    args = parser.parse_args()

    payload = parse_pdf(args.pdf)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"results={len(payload['results'])} output={args.output}")


if __name__ == "__main__":
    main()
