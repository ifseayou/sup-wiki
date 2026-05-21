#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_NAME = "2024西溪湿地皮划艇桨板马拉松挑战赛"
EVENT_SLUG = "xixi-wetland-kayak-sup-marathon-challenge-2024"
PDF_PATH = Path("/Users/xhl/Downloads/桨板赛事/20240420期 杭州西溪皮划艇桨板11公里/2024西溪湿地皮划艇桨板挑战赛成绩册.pdf")
PUBLIC_DIR = "20240420杭州西溪湿地皮划艇桨板马拉松挑战赛"
FILE_NAME = "2024西溪湿地皮划艇桨板挑战赛成绩册.pdf"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
}
STATUS_CODES = set(STATUS_LABELS)


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def status_code(value: str) -> str | None:
    code = clean(value).upper()
    return code if code in STATUS_CODES else None


def normalize_time(value: str) -> str:
    text = clean(value).upper()
    text = text.replace("：", ":").replace("′", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    return text


def time_seconds(value: str) -> float | None:
    text = normalize_time(value)
    if status_code(text):
        return None
    match = re.fullmatch(r"(\d+):(\d{2})'(\d{2})\"?", text)
    if not match:
        return None
    hours, minutes, seconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + int(seconds)


def parse_row(line: str, group: str, page_number: int, status_index: int) -> tuple[dict[str, Any] | None, int]:
    match = re.fullmatch(r"([女]?\d{1,3})\s+(.+?)\s+(\d{1,2}:\d{2}[′']\d{2}\"?|DNS|DNF|DQ|DSQ)\s+(\d+|DNS|DNF|DQ|DSQ)", line, re.I)
    if not match:
        return None, status_index
    bib_number, athlete_name, finish_raw, rank_raw = match.groups()
    finish = normalize_time(finish_raw)
    code = status_code(finish)
    if code:
        status_index += 1
        rank = 9000 + status_index
    else:
        rank = int(rank_raw)
    return {
        "athlete_name_snapshot": clean(athlete_name).replace(" ", ""),
        "bib_number": bib_number,
        "gender_group": group,
        "discipline": "11公里",
        "board_class": "桨板",
        "round_label": "决赛",
        "rank_position": rank,
        "result_label": None,
        "finish_time": finish,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code or ""),
        "time_seconds": time_seconds(finish),
        "points": None,
        "team_name": "个人",
        "team_members": [],
        "source_locator": f"page:{page_number}",
        "source_note": f"{group} 11公里",
        "parse_confidence": 0.99,
        "review_status": "confirmed",
    }, status_index


def parse_pdf(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    results: list[dict[str, Any]] = []
    current_group = ""
    status_index_by_group: dict[str, int] = {}

    for page_number, page in enumerate(reader.pages, start=1):
        if page_number not in {3, 4, 6, 7}:
            continue
        for raw in (page.extract_text() or "").splitlines():
            line = clean(raw)
            if not line or line.startswith(("2024西溪", "成绩册", "编号 ")):
                continue
            if line.startswith("组别："):
                title = clean(line.replace("组别：", "").split("日期：", 1)[0])
                if "桨板" not in title:
                    current_group = ""
                    continue
                current_group = title
                status_index_by_group.setdefault(current_group, 0)
                continue
            if not current_group:
                continue
            parsed, status_index_by_group[current_group] = parse_row(
                line,
                current_group,
                page_number,
                status_index_by_group[current_group],
            )
            if parsed:
                results.append(parsed)
            elif re.search(r"\d{1,3}\s+.+\s+(\d{1,2}:\d{2}|DNS|DNF|DQ|DSQ)", line, re.I):
                raise ValueError(f"Unparsed SUP row on page {page_number}: {line}")

    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "start_date": "2024-04-20",
            "end_date": "2024-04-20",
            "province": "浙江省",
            "city": "杭州市",
            "venue": "西溪湿地",
            "event_status": "completed",
            "result_status": "extended_complete",
            "source_scope": "本地成绩册导入",
            "result_source_note": "仅录入2024西溪湿地皮划艇桨板马拉松挑战赛成绩册中的桨板组别明细。",
        },
        "source": {
            "original_path": str(path),
            "file_name": FILE_NAME,
            "file_type": "pdf",
            "source_url": f"/result-books/{PUBLIC_DIR}/{FILE_NAME}",
            "parser_name": "parse-xixi-wetland-2024-results.py",
            "parser_status": "parsed",
            "parser_note": "仅抽取第3-4页男子单人桨板、第6页女子单人桨板、第7页青少年桨板；跳过皮艇组别。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "local_result_book",
                "relative_path": f"{PUBLIC_DIR}/{FILE_NAME}",
                "event_key": EVENT_SLUG,
                "page_range": "3-4,6-7",
                "excluded_pages": "1-2男子皮艇,5女子皮艇,7青少年皮艇",
            },
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("-o", "--output", type=Path, default=Path(".cache/xixi-wetland-2024-results.json"))
    args = parser.parse_args()
    payload = parse_pdf(PDF_PATH)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"results={len(payload['results'])} output={args.output}")


if __name__ == "__main__":
    main()
