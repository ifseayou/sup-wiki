#!/usr/bin/env python3
"""Parse Wujiang 2026 SUP-only results from the mixed canoe/SUP PDF."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

import pdfplumber


EVENT = {
    "event_id": 382,
    "name": "2026第十届长三角皮划艇桨板大赛暨2026苏州市桨板系列赛吴江站",
    "slug": "yangtze-river-delta-canoe-sup-suzhou-wujiang-2026",
    "start_date": "2026-06-27",
    "end_date": "2026-06-27",
    "province": "江苏省",
    "city": "苏州市",
    "venue": "苏州湾旅游区顾家荡路码头",
    "result_status": "extended_complete",
    "source_scope": "本地成绩册导入",
    "result_source_note": "成绩表导入：仅录入标题含“桨板”的项目，成绩取“实际成绩”列；未录入皮艇、国际邀请组和实际成绩为空的记录。",
}

SOURCE_URL = "https://sup.iaddu.cn/result-books/yangtze-river-delta-canoe-sup-suzhou-wujiang-2026/results-book.pdf"
OUTPUT = Path(".cache/yangtze-river-delta-canoe-sup-suzhou-wujiang-2026-results.json")

PROJECTS = {
    "6公里自带桨板男单": ("6公里桨板", "男子组", "自带板"),
    "6公里自带桨板女单": ("6公里桨板", "女子组", "自带板"),
    "青少年2公里统一桨板男单": ("青少年2公里桨板", "男子组", "统一板"),
    "青少年2公里统一桨板女单": ("青少年2公里桨板", "女子组", "统一板"),
}


def clean(value: Any) -> str:
    return str(value or "").strip()


def timed_row(row: list[Any]) -> bool:
    return len(row) >= 7 and clean(row[0]).isdigit() and bool(clean(row[6]))


def title_row(row: list[Any]) -> str | None:
    if not row:
        return None
    cells = [clean(cell) for cell in row]
    if cells[0] and not cells[0].isdigit() and cells[0] != "排名" and not any(cells[1:]):
        return cells[0]
    return None


def parse_pdf(pdf_path: Path) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    current_title: str | None = None
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            for table in page.extract_tables() or []:
                for row in table:
                    title = title_row(row)
                    if title:
                        current_title = title
                        continue
                    if not current_title or current_title not in PROJECTS:
                        continue
                    if not timed_row(row):
                        continue

                    discipline, gender_group, board_class = PROJECTS[current_title]
                    rank, name, bib, heat, _subtract, _raw_time, actual_time = [clean(cell) for cell in row[:7]]
                    results.append({
                        "athlete_name_snapshot": name,
                        "bib_number": bib or None,
                        "gender_group": gender_group,
                        "discipline": discipline,
                        "board_class": board_class,
                        "round_label": "决赛",
                        "rank_position": int(rank),
                        "result_label": heat or None,
                        "finish_time": actual_time,
                        "result_status_code": None,
                        "result_status_note": None,
                        "time_seconds": None,
                        "points": None,
                        "team_name": "个人",
                        "team_members": [],
                        "nationality_snapshot": "中国",
                        "source_locator": f"page:{page_no}",
                        "source_note": current_title,
                        "parse_confidence": 0.99,
                        "review_status": "confirmed",
                        "is_verified": True,
                    })
    return results


def build_payload(pdf_path: Path) -> dict[str, Any]:
    results = parse_pdf(pdf_path)
    return {
        "event": EVENT,
        "source": {
            "original_path": str(pdf_path.resolve()),
            "file_name": pdf_path.name,
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "parser_name": "parse-wujiang-2026-results.py",
            "parser_status": "parsed",
            "parser_note": "仅解析桨板项目：6公里自带桨板男/女单、青少年2公里统一桨板男/女单；成绩取实际成绩列。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "local_result_book",
                "scope": "sup_only_actual_time",
                "excluded": ["皮艇项目", "国际邀请组", "实际成绩为空的记录"],
                "status_counts": dict(Counter(row.get("result_status_code") or "OK" for row in results)),
            },
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default=str(OUTPUT))
    args = parser.parse_args()

    payload = build_payload(Path(args.input))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    rows = payload["results"]
    modules = Counter((row["discipline"], row["gender_group"], row["board_class"]) for row in rows)
    print(f"wrote {output} results={len(rows)} modules={len(modules)}")
    for key, count in modules.items():
        print(key, count)


if __name__ == "__main__":
    main()
