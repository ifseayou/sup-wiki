#!/usr/bin/env python3
"""Parse 2024 桨下江南 18KM SUP results from Excel."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pandas as pd


EVENT_NAME = "2024桨下江南"
PDF_PATH = Path("/Users/xhl/Downloads/桨板赛事/20241005期 桨下江南/18KM桨板项目系列成绩.xlsx")
PUBLIC_BOOK_DIR_NAME = "20241005期 桨下江南"
INCLUDED_SHEETS = {
    "18KM男子桨板公开组": "公开男子组",
    "18KM女子桨板公开组": "公开女子组",
    "18KM男子桨板大师组": "大师男子组",
    "18KM女子桨板大师组": "大师女子组",
}


def clean(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() == "nan":
        return ""
    return re.sub(r"\s+", " ", text)


def normalize_time(value: Any) -> str:
    text = clean(value)
    if not text:
        return ""
    return text


def source_url(file_name: str) -> str:
    return f"/result-books/{quote(PUBLIC_BOOK_DIR_NAME, safe='')}/{quote(file_name, safe='')}"


def parse_rank(value: Any) -> int | None:
    text = clean(value)
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def parse_sheet(path: Path, sheet_name: str, gender_group: str) -> list[dict[str, Any]]:
    df = pd.read_excel(path, sheet_name=sheet_name, dtype=str)
    results: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        rank = parse_rank(row.get("名次"))
        bib = clean(row.get("参赛号"))
        name = clean(row.get("姓名"))
        finish = normalize_time(row.get("赛会成绩"))
        if rank is None or not bib or not name or not finish:
            continue
        results.append(
            {
                "athlete_name_snapshot": name,
                "bib_number": bib,
                "gender_group": gender_group,
                "discipline": "18公里",
                "board_class": None,
                "round_label": "决赛",
                "rank_position": rank,
                "result_label": None,
                "finish_time": finish,
                "result_status_code": None,
                "result_status_note": None,
                "time_seconds": None,
                "points": None,
                "team_name": "个人",
                "team_members": [],
                "source_locator": f"sheet:{sheet_name}",
                "source_note": f"2024桨下江南 18KM桨板项目系列成绩.xlsx {sheet_name}",
                "parse_confidence": 0.99,
                "review_status": "confirmed",
                "is_verified": True,
                "source_title": path.name,
                "source_url": source_url(path.name),
            }
        )
    return results


def duplicate_rank_issues(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: dict[tuple[str, str, str, str, int], int] = {}
    for row in results:
        key = (
            row["discipline"],
            row["gender_group"],
            row.get("board_class") or "",
            row.get("round_label") or "",
            int(row["rank_position"]),
        )
        counts[key] = counts.get(key, 0) + 1
    return [
        {
            "discipline": key[0],
            "gender_group": key[1],
            "board_class": key[2] or None,
            "round_label": key[3],
            "rank": key[4],
            "count": count,
        }
        for key, count in counts.items()
        if count > 1
    ]


def parse_workbook(path: Path) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    contexts: list[str] = []
    for sheet_name, gender_group in INCLUDED_SHEETS.items():
        rows = parse_sheet(path, sheet_name, gender_group)
        contexts.append(f"{sheet_name}:{gender_group}:{len(rows)}")
        results.extend(rows)
    return {
        "event": {
            "name": EVENT_NAME,
            "result_status": "extended_complete",
            "result_source_note": "按本地Excel《18KM桨板项目系列成绩.xlsx》重建分组成绩；男女总榜未导入，避免重复成绩。",
        },
        "source": {
            "original_path": str(path),
            "file_name": path.name,
            "file_type": "xlsx",
            "source_url": source_url(path.name),
            "parser_name": "parse-jiangxia-jiangnan-2024-results.py",
            "parser_status": "parsed",
            "parser_note": "仅导入公开/大师男女四个分组sheet，跳过男女总榜sheet。",
            "extracted_rows": len(results),
            "metadata": {
                "sheet_contexts": contexts,
                "source_kind": "local_result_book",
                "results_only": True,
                "skipped_sheets": ["18KM男子桨板", "18KM女子桨板"],
                "duplicate_rank_issues": duplicate_rank_issues(results),
            },
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(PDF_PATH))
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    payload = parse_workbook(Path(args.input))
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    for context in payload["source"]["metadata"]["sheet_contexts"]:
        print(context)
    issues = payload["source"]["metadata"]["duplicate_rank_issues"]
    if issues:
        print("duplicate_rank_issues:")
        for issue in issues:
            print(issue)
    print(f"wrote 1 source, {len(payload['results'])} results -> {output_path}")


if __name__ == "__main__":
    main()
