#!/usr/bin/env python3
"""Parse 2025 中国桨板俱乐部联赛庐山西海站 result pages."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pdfplumber


EVENT_NAME = "2025年中国桨板俱乐部联赛庐山西海站"
EVENT_SLUG = "china-sup-club-league-lushan-xihai-2025"
PDF_PATH = Path("/Users/xhl/Downloads/桨板赛事/20250823 中国桨板俱乐部联赛庐山西海站/2025年中国桨板俱乐部联赛庐山西海站-成绩册.pdf")
PUBLIC_BOOK_DIR_NAME = "20250823 中国桨板俱乐部联赛庐山西海站"
FIRST_RESULT_PAGE = 24
LAST_RESULT_PAGE = 58

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
    "DNQ": "未晋级",
    "OTL": "超过关门时间",
}


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("（", "(").replace("）", ")").replace("：", ":")
    text = text.replace("S·K", "S·K")
    return re.sub(r"\s+", " ", text)


def status_code(value: str) -> str | None:
    text = clean(value).upper()
    return text if text in STATUS_LABELS else None


def normalize_time(value: str) -> str:
    text = clean(value).upper().replace("O", "0")
    if status_code(text):
        return text
    return text


def is_time_or_status(value: str) -> bool:
    text = normalize_time(value)
    return bool(status_code(text) or re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?", text))


def source_url(file_name: str) -> str:
    return f"/result-books/{quote(PUBLIC_BOOK_DIR_NAME, safe='')}/{quote(file_name, safe='')}"


def normalize_group(group: str, gender: str) -> str:
    text = clean(group).replace("组", "")
    if re.fullmatch(r"U\d+", text, re.I):
        return f"{text.upper()}{gender}组"
    return f"{text}{gender}组"


def page_title(page: pdfplumber.page.Page) -> str:
    words = page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False) or []
    return clean(" ".join(word["text"] for word in words if float(word["top"]) < 155))


def context_from_title(title: str, file_name: str, page_number: int) -> dict[str, Any] | None:
    long_match = re.search(r"((?:公开|大师|卡胡纳|高校|U\d+)组)(男子|女子)\s*(\d+)\s*km\s*耐力赛", title, re.I)
    if long_match:
        group, gender, distance = long_match.groups()
        return {
            "discipline": f"{distance}公里",
            "gender_group": normalize_group(group, gender),
            "board_class": None,
            "round_label": "决赛",
            "layout": "long",
            "source_note": f"庐山西海成绩册 {file_name} 第{page_number}页 {group}{gender}{distance}km耐力赛决赛",
        }

    sprint_match = re.search(r"((?:公开|大师|卡胡纳|高校|U\d+)组)(男子|女子)\s*冲刺赛决赛", title, re.I)
    if sprint_match:
        group, gender = sprint_match.groups()
        return {
            "discipline": "竞速赛",
            "gender_group": normalize_group(group, gender),
            "board_class": None,
            "round_label": "决赛",
            "layout": "sprint",
            "source_note": f"庐山西海成绩册 {file_name} 第{page_number}页 {group}{gender}冲刺赛决赛",
        }
    return None


def line_text(words: list[dict[str, Any]], left: float, right: float) -> str:
    return clean(" ".join(word["text"] for word in words if left <= float(word["x0"]) < right))


def group_lines(words: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    body = [word for word in words if float(word["top"]) > 155]
    lines: list[list[dict[str, Any]]] = []
    for word in sorted(body, key=lambda item: (float(item["top"]), float(item["x0"]))):
        if not lines or abs(float(lines[-1][0]["top"]) - float(word["top"])) > 5.2:
            lines.append([word])
        else:
            lines[-1].append(word)
    return [sorted(line, key=lambda item: float(item["x0"])) for line in lines]


def make_result(
    context: dict[str, Any],
    page_number: int,
    rank: int,
    bib: str,
    name: str,
    team: str,
    finish: str,
    source_note: str,
    result_label: str | None = None,
) -> dict[str, Any]:
    finish_time = normalize_time(finish)
    code = status_code(finish_time)
    return {
        "athlete_name_snapshot": clean(name),
        "bib_number": clean(bib) or None,
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class"),
        "round_label": context.get("round_label") or "决赛",
        "rank_position": rank,
        "result_label": result_label,
        "finish_time": finish_time,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code),
        "time_seconds": None,
        "points": None,
        "team_name": clean(team) or "个人",
        "team_members": [],
        "source_locator": f"page:{page_number}",
        "source_note": source_note,
        "parse_confidence": 0.98,
        "review_status": "confirmed",
        "is_verified": True,
    }


def parse_page(page: pdfplumber.page.Page, context: dict[str, Any], page_number: int) -> list[dict[str, Any]]:
    words = page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False) or []
    results: list[dict[str, Any]] = []
    status_counter = 0
    for line in group_lines(words):
        full_line = clean(" ".join(word["text"] for word in line))
        if "预赛轮" in full_line:
            continue
        if not any(is_time_or_status(word["text"]) for word in line):
            continue

        if context["layout"] == "sprint":
            rank_text = line_text(line, 60, 100)
            lane_text = line_text(line, 100, 150)
            bib = line_text(line, 150, 205)
            name = line_text(line, 200, 275)
            team = line_text(line, 270, 430)
            finish = line_text(line, 430, 505)
            note = f"{context['source_note']} 出发位置:{lane_text}" if lane_text else context["source_note"]
        else:
            rank_text = line_text(line, 60, 105)
            bib = line_text(line, 105, 175)
            name = line_text(line, 175, 250)
            team = line_text(line, 245, 430)
            finish = line_text(line, 430, 500)
            note = context["source_note"]

        if re.fullmatch(r"\d{1,3}", rank_text):
            rank = int(rank_text)
        elif status_code(finish):
            status_counter += 1
            rank = 9000 + status_counter
            note = f"{note}；PDF名次列为空，按状态记录排序"
        else:
            continue

        if not bib or not name or not is_time_or_status(finish):
            continue
        results.append(make_result(context, page_number, rank, bib, name, team, finish, note))
    return results


def parse_pdf(pdf_path: Path) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    contexts: list[str] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number in range(FIRST_RESULT_PAGE, min(LAST_RESULT_PAGE, len(pdf.pages)) + 1):
            page = pdf.pages[page_number - 1]
            title = page_title(page)
            context = context_from_title(title, pdf_path.name, page_number)
            if not context:
                continue
            page_results = parse_page(page, context, page_number)
            contexts.append(f"{page_number}:{context['discipline']}:{context['gender_group']}:{len(page_results)}")
            for row in page_results:
                row["source_title"] = pdf_path.name
                row["source_url"] = source_url(pdf_path.name)
            results.extend(page_results)

    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "province": "江西省",
            "city": "九江市",
            "venue": "庐山西海",
            "start_date": "2025-08-23",
            "end_date": "2025-08-24",
            "event_status": "completed",
            "result_status": "extended_complete",
            "result_source_note": "庐山西海站本地PDF成绩册第24-58页成绩单重解析导入；第2-23页积分未导入。",
        },
        "source": {
            "original_path": str(pdf_path),
            "file_name": pdf_path.name,
            "file_type": "pdf",
            "source_url": source_url(pdf_path.name),
            "parser_name": "parse-lushan-xihai-2025-results.py",
            "parser_status": "parsed",
            "parser_note": "庐山西海站PDF成绩页重解析；积分榜和预赛轮DNS未导入。",
            "extracted_rows": len(results),
            "metadata": {
                "page_contexts": contexts,
                "source_kind": "local_result_book",
                "results_only": True,
                "skipped_pages": "1-23,59",
            },
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(PDF_PATH))
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    payload = parse_pdf(Path(args.input))
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    for context in payload["source"]["metadata"]["page_contexts"]:
        print(context)
    print(f"wrote 1 source, {len(payload['results'])} results -> {output_path}")


if __name__ == "__main__":
    main()
