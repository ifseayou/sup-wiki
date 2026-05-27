#!/usr/bin/env python3
"""Parse 2025 中国桨板俱乐部联赛总决赛（云和站） result book pages 1-34."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import pdfplumber


EVENT_ID = 190
SOURCE_ID = 245
EVENT_NAME = "2025中国桨板俱乐部联赛总决赛（云漫杯-第四届云和水上运动嘉年华）"
SOURCE_URL = "/result-books/2025-10-25日云漫杯-云和/2025中国桨板俱乐部联赛总决赛（云和站）成绩册.pdf"
ORIGINAL_PATH = "/Users/xhl/Downloads/桨板赛事/20251025 中国桨板俱乐部联赛总决赛云和/2025中国桨板俱乐部联赛总决赛（云和站）成绩册.pdf"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DSQ": "取消成绩",
    "DQ": "取消成绩",
    "DNQ": "未晋级",
}
STATUS_CODES = set(STATUS_LABELS)


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("（", "(").replace("）", ")")
    return re.sub(r"\s+", " ", text)


def status_code(value: str) -> str | None:
    text = clean(value).upper()
    return text if text in STATUS_CODES else None


def status_note(code: str | None) -> str | None:
    return STATUS_LABELS.get(code or "")


def normalize_time(value: str) -> str:
    text = clean(value).upper()
    return text


def split_members(value: str) -> list[str]:
    return [item.strip() for item in re.split(r"[/、,，;；]+", value) if item.strip()]


def context_from_title(line: str) -> dict[str, Any] | None:
    text = clean(line)
    if "龙板赛" in text and "成绩单" in text:
        return {
            "discipline": "龙板200米",
            "gender_group": "龙板组",
            "board_class": "龙板",
            "round_label": "决赛",
            "is_team": True,
        }
    match = re.search(r"((?:公开|大师|卡胡纳|U\d+)(?:男子|女子)组?)(6KM耐力赛|3KM耐力赛|200米冲刺赛)\s+成绩单", text, re.I)
    if not match:
        return None
    group = normalize_group(match.group(1))
    event_type = match.group(2).upper()
    if "6KM" in event_type:
        discipline = "6公里"
    elif "3KM" in event_type:
        discipline = "3公里"
    else:
        discipline = "200米"
    return {
        "discipline": discipline,
        "gender_group": group,
        "board_class": "卡胡纳" if "卡胡纳" in group else None,
        "round_label": "决赛",
        "is_team": False,
    }


def normalize_group(value: str) -> str:
    text = clean(value)
    if re.fullmatch(r"U\d+(?:男子|女子)", text):
        return f"{text}组"
    if re.fullmatch(r"卡胡纳(?:男子|女子)", text):
        return f"{text}组"
    return text


def extract_pages(pdf_path: Path, max_page: int = 34) -> list[tuple[int, list[str]]]:
    pages: list[tuple[int, list[str]]] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number, page in enumerate(pdf.pages[:max_page], 1):
            text = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
            lines = [clean(line) for line in text.splitlines() if clean(line)]
            pages.append((page_number, lines))
    return pages


def split_line_rows(line: str) -> list[str]:
    text = clean(line)
    single_patterns = [
        r"^\d{1,3}\s+\d{3}\s+.+\s(?:DSQ|DNF|DNS|DQ|DNQ|(?:\d{1,2}:)?\d{2}:\d{2}\.\d{2}|\d{2}:\d{2}\.\d{2})(?:\s.*)?$",
        r"^\d{1,3}\s+(?:\d{1,2}|[^\s]+赛第\d+名)\s+\d{3}\s+.+\s(?:DSQ|DNF|DNS|DQ|DNQ|(?:\d{1,2}:)?\d{2}:\d{2}\.\d{2}|\d{2}:\d{2}\.\d{2})(?:\s.*)?$",
        r"^/\s+(?:/|\d+|预赛)\s+\d{3}\s+.+\s(?:DSQ|DNF|DNS|DQ|DNQ)(?:\s.*)?$",
        r"^\d{3}\s+.+\s(?:DSQ|DNF|DNS|DQ|DNQ)(?:\s.*)?$",
    ]
    if any(re.match(pattern, text, re.I) for pattern in single_patterns):
        return [text]
    # Some PDF lines glue rows together after the result field.
    pattern = re.compile(
        r"(?=(?:\d{1,3}\s+(?:\d{1,2}|[^\s]+赛第\d+名)\s+\d{3}\s+|/\s+(?:/|\d+|预赛)\s+\d{3}\s+|\d{3}\s+|[A-Z]{2,3}\s+\d{3}\s+))"
    )
    starts = [m.start() for m in pattern.finditer(text)]
    if len(starts) <= 1:
        return [text]
    rows = []
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else len(text)
        row = text[start:end].strip()
        if row:
            rows.append(row)
    return rows


def split_finish_tail(text: str) -> tuple[str, str, str | None] | None:
    match = re.search(r"\s(DSQ|DNF|DNS|DQ|DNQ|(?:\d{1,2}:)?\d{2}:\d{2}\.\d{2}|\d{2}:\d{2}\.\d{2})(?:\s*(.*))?$", text, re.I)
    if not match:
        return None
    prefix = text[: match.start()].strip()
    finish = normalize_time(match.group(1))
    note = clean(match.group(2)) or None
    return prefix, finish, note


def split_name_team(prefix: str) -> tuple[str, str] | None:
    parts = clean(prefix).split(" ", 1)
    if len(parts) < 2:
        return None
    return parts[0], parts[1] or "个人"


def make_result(
    context: dict[str, Any],
    *,
    page_number: int,
    rank_position: int,
    bib_number: str | None,
    athlete_name: str,
    team_name: str,
    finish_time: str,
    result_label: str | None = None,
    team_members: list[str] | None = None,
) -> dict[str, Any]:
    code = status_code(finish_time)
    return {
        "athlete_name_snapshot": athlete_name,
        "bib_number": bib_number,
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class"),
        "round_label": context.get("round_label") or "决赛",
        "rank_position": rank_position,
        "result_label": result_label,
        "finish_time": finish_time,
        "result_status_code": code,
        "result_status_note": status_note(code),
        "team_name": team_name or "个人",
        "team_members": team_members or [],
        "points": None,
        "source_locator": f"page:{page_number}",
        "parse_confidence": 0.96,
        "review_status": "confirmed",
        "source_note": "云和总决赛成绩册第1-34页重解析",
    }


def parse_individual_row(context: dict[str, Any], row: str, page_number: int, status_counter: int) -> tuple[dict[str, Any] | None, int]:
    text = clean(row)
    if not text or text.startswith(("名次 ", "NO.", "总裁判长", "2025年中国")):
        return None, status_counter

    if context["discipline"] == "200米":
        ranked = re.match(r"^(\d{1,3})\s+(\d{1,2}|[^\s]+赛第\d+名)\s+(\d{3})\s+(.+)$", text)
        status = None if ranked else re.match(r"^/\s+(?:/|\d+|预赛)\s+(\d{3})\s+(.+)$", text)
        plain_status = None if ranked or status else re.match(r"^(\d{3})\s+(.+)$", text)
        if ranked:
            rank = int(ranked.group(1))
            result_label = ranked.group(2) if "赛第" in ranked.group(2) else None
            bib = ranked.group(3)
            rest = ranked.group(4)
        elif status:
            status_counter += 1
            rank = 9000 + status_counter
            result_label = None
            bib = status.group(1)
            rest = status.group(2)
        elif plain_status:
            tail_check = split_finish_tail(plain_status.group(2))
            if not tail_check or not status_code(tail_check[1]):
                return None, status_counter
            status_counter += 1
            rank = 9000 + status_counter
            result_label = None
            bib = plain_status.group(1)
            rest = plain_status.group(2)
        else:
            return None, status_counter
    else:
        ranked = re.match(r"^(\d{1,3})\s+(\d{3})\s+(.+)$", text)
        status = None if ranked else re.match(r"^(\d{3})\s+(.+)$", text)
        if ranked:
            rank = int(ranked.group(1))
            result_label = None
            bib = ranked.group(2)
            rest = ranked.group(3)
        elif status:
            status_counter += 1
            rank = 9000 + status_counter
            result_label = None
            bib = status.group(1)
            rest = status.group(2)
        else:
            return None, status_counter

    tail = split_finish_tail(rest)
    if not tail:
        return None, status_counter
    prefix, finish_time, note = tail
    name_team = split_name_team(prefix)
    if not name_team:
        return None, status_counter
    name, team = name_team
    if note and not result_label:
        result_label = note
    elif note and result_label:
        result_label = f"{result_label} {note}"
    return (
        make_result(
            context,
            page_number=page_number,
            rank_position=rank,
            bib_number=bib,
            athlete_name=name,
            team_name=team,
            finish_time=finish_time,
            result_label=result_label,
        ),
        status_counter,
    )


def parse_team_page(context: dict[str, Any], lines: list[str], page_number: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    status_counter = 0
    index = 0
    while index < len(lines):
        bibs = clean(lines[index])
        if not re.fullmatch(r"\d{3}(?:/\d{3}){3}", bibs):
            index += 1
            continue
        if index + 2 >= len(lines):
            break
        middle = clean(lines[index + 1])
        members_raw = clean(lines[index + 2])
        ranked = re.match(r"^(\d{1,3})\s+(\d+|预赛)\s+(.+?)\s+(DSQ|DNF|DNS|DQ|DNQ|(?:\d{1,2}:)?\d{2}:\d{2}\.\d{2})$", middle, re.I)
        status = None if ranked else re.match(r"^/\s+/\s+(.+?)\s+(DSQ|DNF|DNS|DQ|DNQ)$", middle, re.I)
        if ranked:
            rank = int(ranked.group(1))
            result_label = ranked.group(2) if ranked.group(2) == "预赛" else None
            team = ranked.group(3)
            finish = normalize_time(ranked.group(4))
        elif status:
            status_counter += 1
            rank = 9000 + status_counter
            result_label = None
            team = status.group(1)
            finish = normalize_time(status.group(2))
        else:
            index += 1
            continue
        members = split_members(members_raw)
        primary = members[0] if members else team
        rows.append(
            make_result(
                context,
                page_number=page_number,
                rank_position=rank,
                bib_number=bibs,
                athlete_name=primary,
                team_name=team,
                finish_time=finish,
                result_label=result_label,
                team_members=members,
            )
        )
        index += 3
    return rows


def parse_pdf(pdf_path: Path) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    status_counters: dict[str, int] = {}

    for page_number, lines in extract_pages(pdf_path, 34):
        page_context = None
        for line in lines[:8]:
            found = context_from_title(line)
            if found:
                page_context = found
                break
        if page_context:
            current = page_context
        if not current:
            continue
        if current.get("is_team"):
            results.extend(parse_team_page(current, lines, page_number))
            continue

        counter_key = f"{current['discipline']}|{current['gender_group']}"
        status_counter = status_counters.get(counter_key, 0)
        for line in lines:
            for row in split_line_rows(line):
                parsed, status_counter = parse_individual_row(current, row, page_number, status_counter)
                if parsed:
                    results.append(parsed)
        status_counters[counter_key] = status_counter

    return {
        "event": {
            "event_id": EVENT_ID,
            "name": EVENT_NAME,
            "start_date": "2025-10-25",
            "end_date": "2025-10-26",
            "province": "浙江省",
            "city": "丽水市",
            "venue": "云和",
        },
        "source": {
            "source_id": SOURCE_ID,
            "file_name": "2025中国桨板俱乐部联赛总决赛（云和站）成绩册.pdf",
            "source_url": SOURCE_URL,
            "original_path": ORIGINAL_PATH,
            "parser_name": "parse-yunhe-2025-results.py",
            "parser_note": "仅解析第1-34页成绩册，忽略第35页之后积分页。",
        },
        "results": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    payload = parse_pdf(Path(args.pdf))
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    groups: dict[str, int] = {}
    pages: dict[str, int] = {}
    for row in payload["results"]:
        key = " / ".join([row["discipline"], row["gender_group"], row.get("board_class") or "-"])
        groups[key] = groups.get(key, 0) + 1
        pages[row["source_locator"]] = pages.get(row["source_locator"], 0) + 1
    print(json.dumps({"rows": len(payload["results"]), "groups": groups, "pages": pages}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
