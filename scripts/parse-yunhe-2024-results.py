#!/usr/bin/env python3
"""Parse 2024 中国桨板超级联赛云和站 result book."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pdfplumber


EVENT_NAME = "2024中国桨板超级联赛-云和站（云漫杯-第三届云和水上运动嘉年华）"
EVENT_SLUG = "china-sup-super-league-yunhe-2024"
PDF_PATH = Path("/Users/xhl/Downloads/桨板赛事/20241109期 中国桨板超级联赛云和站/成绩册(1).pdf")
PUBLIC_BOOK_DIR_NAME = "20241109期 中国桨板超级联赛云和站"
SOURCE_ID = 305

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
    return re.sub(r"\s+", " ", text)


def status_code(value: str) -> str | None:
    text = clean(value).upper()
    return text if text in STATUS_LABELS else None


def normalize_time(value: str) -> str:
    return clean(value).upper().replace("O", "0")


def source_url(file_name: str) -> str:
    return f"/result-books/{quote(PUBLIC_BOOK_DIR_NAME, safe='')}/{quote(file_name, safe='')}"


def split_members(value: str) -> list[str]:
    return [item.strip() for item in re.split(r"[/、,，;；\s]+", clean(value)) if item.strip()]


def is_result_value(value: str) -> bool:
    text = normalize_time(value)
    return bool(status_code(text) or re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?", text))


def make_result(
    context: dict[str, Any],
    page_number: int,
    rank: int,
    bib: str | None,
    athlete_name: str,
    team_name: str,
    finish_time: str,
    result_label: str | None = None,
    team_members: list[str] | None = None,
    confidence: float = 0.96,
) -> dict[str, Any]:
    finish = normalize_time(finish_time)
    code = status_code(finish)
    return {
        "athlete_name_snapshot": clean(athlete_name),
        "bib_number": clean(bib) or None,
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class"),
        "round_label": context.get("round_label") or "决赛",
        "rank_position": rank,
        "result_label": clean(result_label) or None,
        "finish_time": finish,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code),
        "time_seconds": None,
        "points": None,
        "team_name": clean(team_name) or "个人",
        "team_members": team_members or [],
        "source_locator": f"page:{page_number}",
        "source_note": context["source_note"],
        "parse_confidence": confidence,
        "review_status": "confirmed",
        "is_verified": True,
    }


def page_lines(page: pdfplumber.page.Page) -> list[str]:
    text = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
    return [clean(line) for line in text.splitlines() if clean(line)]


def context_from_lines(lines: list[str], page_number: int) -> dict[str, Any] | None:
    head = " ".join(lines[:4])
    long_match = re.search(r"((?:公开|大师|卡胡纳|高校|U\d+)组)(男子|女子)长距离赛", head, re.I)
    if long_match:
        group, gender = long_match.groups()
        return {
            "discipline": "长距离赛",
            "gender_group": normalize_group(group, gender),
            "board_class": "卡胡纳" if "卡胡纳" in group else None,
            "round_label": "决赛",
            "kind": "individual",
            "source_note": f"云和2024成绩册第{page_number}页 {group}{gender}长距离赛",
        }

    sprint_match = re.search(r"((?:公开|大师|卡胡纳|高校|U\d+)组)(男子|女子)竞速(?:赛)?决赛", head, re.I)
    if sprint_match:
        group, gender = sprint_match.groups()
        return {
            "discipline": "200米竞速赛",
            "gender_group": normalize_group(group, gender),
            "board_class": "卡胡纳" if "卡胡纳" in group else None,
            "round_label": "决赛",
            "kind": "sprint",
            "source_note": f"云和2024成绩册第{page_number}页 {group}{gender}竞速赛决赛",
        }

    paddle_match = re.search(r"((?:U\d+)组)(男子|女子)趴板赛决赛", head, re.I)
    if paddle_match:
        group, gender = paddle_match.groups()
        return {
            "discipline": "趴板赛",
            "gender_group": normalize_group(group, gender),
            "board_class": "趴板",
            "round_label": "决赛",
            "kind": "paddle",
            "source_note": f"云和2024成绩册第{page_number}页 {group}{gender}趴板赛决赛",
        }

    if "接力赛" in head and "成绩单" in head:
        return {
            "discipline": "接力赛",
            "gender_group": "接力组",
            "board_class": "接力",
            "round_label": "决赛",
            "kind": "team",
            "member_count": 5,
            "source_note": f"云和2024成绩册第{page_number}页 接力赛决赛",
        }

    if "龙板赛" in head and "成绩单" in head:
        return {
            "discipline": "龙板赛",
            "gender_group": "龙板组",
            "board_class": "龙板",
            "round_label": "决赛",
            "kind": "team",
            "member_count": 4,
            "source_note": f"云和2024成绩册第{page_number}页 龙板赛决赛",
        }

    return None


def normalize_group(group: str, gender: str) -> str:
    text = clean(group).replace("组", "")
    if re.fullmatch(r"U\d+", text, re.I):
        return f"{text.upper()}{gender}组"
    return f"{text}{gender}组"


def split_row_tail(rest: str) -> tuple[str, str, str | None] | None:
    match = re.search(
        r"\s(DNS|DNF|DSQ|DQ|DNQ|OTL|\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?)(?:\s+(.+))?$",
        rest,
        re.I,
    )
    if not match:
        return None
    prefix = clean(rest[: match.start()])
    finish = normalize_time(match.group(1))
    note = clean(match.group(2)) or None
    return prefix, finish, note


def split_name_team(prefix: str) -> tuple[str, str] | None:
    parts = clean(prefix).split(" ", 1)
    if len(parts) < 2:
        return None
    return parts[0], parts[1] or "个人"


def merge_wrapped_lines(lines: list[str]) -> list[str]:
    merged: list[str] = []
    pending: str | None = None
    index = 0
    row_start = re.compile(r"^(?:\d{1,3}\s+)?\d{3}\s+|^\d{1,3}\s+\d{1,2}\s+\d{3}\s+|^\d{1,3}\s+[^\s]+\s+\d{3}\s+")
    while index < len(lines):
        line = lines[index]
        if should_skip_line(line):
            index += 1
            continue
        if not row_start.match(line):
            pending = f"{pending or ''}{line}"
            index += 1
            continue
        row = line
        used_pending = False
        if pending and not row_has_team(row):
            row = insert_before_result_value(row, pending)
            used_pending = True
        pending = None
        while split_row_tail(row) and index + 1 < len(lines):
            nxt = lines[index + 1]
            if should_skip_line(nxt) or row_start.match(nxt):
                break
            if is_score_fragment(nxt):
                break
            if used_pending or not row_has_team(row):
                row = insert_before_result_value(row, nxt)
                used_pending = True
            else:
                break
            index += 1
        merged.append(clean(row))
        index += 1
    return merged


def insert_before_result_value(row: str, fragment: str) -> str:
    match = re.search(
        r"\s(DNS|DNF|DSQ|DQ|DNQ|OTL|\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?)(?:\s+(.+))?$",
        row,
        re.I,
    )
    if not match:
        return clean(f"{row} {fragment}")
    prefix = clean(row[: match.start()])
    finish = normalize_time(match.group(1))
    note = clean(match.group(2))
    suffix = f" {note}" if note else ""
    return clean(f"{prefix} {fragment} {finish}{suffix}")


def row_has_team(row: str) -> bool:
    text = clean(row)
    ranked_lane = re.match(r"^(\d{1,3})\s+(\d{1,2})\s+(\d{3})\s+(.+)$", text)
    ranked_no_lane = re.match(r"^(\d{1,3})\s+(\d{3})\s+(.+)$", text)
    status_lane = re.match(r"^(\d{1,2})\s+(\d{3})\s+(.+)$", text)
    status_no_lane = re.match(r"^(\d{3})\s+(.+)$", text)
    rest = None
    if ranked_lane:
        rest = ranked_lane.group(4)
    elif ranked_no_lane:
        rest = ranked_no_lane.group(3)
    elif status_lane:
        rest = status_lane.group(3)
    elif status_no_lane:
        rest = status_no_lane.group(2)
    if not rest:
        return False
    tail = split_row_tail(rest)
    if not tail:
        return False
    return split_name_team(tail[0]) is not None


def should_skip_line(line: str) -> bool:
    return bool(
        not line
        or line.startswith(("名次 ", "NO.", "No.", "总裁判长", "裁判长", "成绩单", "长距离赛成绩单", "竞速赛-成绩单", "趴板赛-成绩单"))
        or line in {"16:48"}
    )


def is_score_fragment(line: str) -> bool:
    return bool(re.fullmatch(r"\d{1,3}", clean(line)))


def parse_individual_lines(context: dict[str, Any], lines: list[str], page_number: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    status_counter = 0
    in_appendix = False
    for row in merge_wrapped_lines(lines):
        if context["kind"] in {"sprint", "paddle"} and re.search(r"预赛|复赛", row):
            in_appendix = True
        if in_appendix:
            continue
        parsed = parse_individual_row(context, row, page_number, status_counter)
        if parsed:
            item, status_counter = parsed
            rows.append(item)
    return rows


def parse_individual_row(
    context: dict[str, Any],
    row: str,
    page_number: int,
    status_counter: int,
) -> tuple[dict[str, Any], int] | None:
    text = clean(row)
    rank: int
    bib: str
    rest: str
    result_label: str | None = None

    ranked_lane = re.match(r"^(\d{1,3})\s+(\d{1,2})\s+(\d{3})\s+(.+)$", text)
    ranked_no_lane = re.match(r"^(\d{1,3})\s+(\d{3})\s+(.+)$", text)
    status_lane = re.match(r"^(\d{1,2})\s+(\d{3})\s+(.+)$", text)
    status_no_lane = re.match(r"^(\d{3})\s+(.+)$", text)
    status_lane_tail = split_row_tail(status_lane.group(3)) if status_lane else None

    if ranked_lane and context["kind"] in {"sprint", "paddle"}:
        rank = int(ranked_lane.group(1))
        bib = ranked_lane.group(3)
        rest = ranked_lane.group(4)
    elif (
        status_lane
        and context["kind"] in {"sprint", "paddle"}
        and status_lane_tail
        and status_code(status_lane_tail[1])
    ):
        status_counter += 1
        rank = 9000 + status_counter
        result_label = f"出发位置:{status_lane.group(1)}"
        bib = status_lane.group(2)
        rest = status_lane.group(3)
    elif ranked_no_lane:
        rank = int(ranked_no_lane.group(1))
        bib = ranked_no_lane.group(2)
        rest = ranked_no_lane.group(3)
    elif status_no_lane:
        tail_check = split_row_tail(status_no_lane.group(2))
        if not tail_check or not status_code(tail_check[1]):
            return None
        status_counter += 1
        rank = 9000 + status_counter
        bib = status_no_lane.group(1)
        rest = status_no_lane.group(2)
    else:
        return None

    tail = split_row_tail(rest)
    if not tail:
        # Rows like “预赛1 第九名” are appendix rows and are skipped.
        return None
    prefix, finish, note = tail
    name_team = split_name_team(prefix)
    if not name_team or not is_result_value(finish):
        return None
    name, team = name_team
    if note and not result_label:
        result_label = note
    elif note and result_label:
        result_label = f"{result_label} {note}"
    return (
        make_result(context, page_number, rank, bib, name, team, finish, result_label=result_label),
        status_counter,
    )


def parse_team_lines(context: dict[str, Any], lines: list[str], page_number: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    status_counter = 0
    index = 0
    while index < len(lines):
        members_line = lines[index]
        if "/" not in members_line or not re.search(r"[\u4e00-\u9fa5A-Za-z]", members_line):
            index += 1
            continue
        if index + 2 >= len(lines):
            break
        row_line = lines[index + 1]
        bib_line = lines[index + 2]
        if not re.fullmatch(r"\d{3}(?:/\d{3}){3,4}", bib_line):
            index += 1
            continue

        ranked = re.match(r"^(\d{1,3})\s+(.+?)\s+(\d{2}:\d{2}:\d{2}\.\d{3})(?:\s+(.+))?$", row_line)
        if not ranked:
            index += 1
            continue
        rank = int(ranked.group(1))
        team = ranked.group(2)
        finish = ranked.group(3)
        label = clean(ranked.group(4)) or None
        members = split_members(members_line)
        rows.append(
            make_result(
                context,
                page_number,
                rank,
                bib_line,
                members[0] if members else team,
                team,
                finish,
                result_label=label,
                team_members=members,
            )
        )
        index += 3
    return rows


def parse_pdf(pdf_path: Path) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    contexts: list[str] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number in range(27, min(83, len(pdf.pages)) + 1):
            lines = page_lines(pdf.pages[page_number - 1])
            context = context_from_lines(lines, page_number)
            if not context:
                continue
            if context["kind"] == "team":
                page_results = parse_team_lines(context, lines, page_number)
            else:
                page_results = parse_individual_lines(context, lines, page_number)
            if context["kind"] == "sprint" and page_results and not any(row["rank_position"] < 9000 for row in page_results):
                page_results = []
            for row in page_results:
                row["source_title"] = pdf_path.name
                row["source_url"] = source_url(pdf_path.name)
            contexts.append(f"{page_number}:{context['discipline']}:{context['gender_group']}:{context.get('board_class') or '-'}:{len(page_results)}")
            results.extend(page_results)

    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "province": "浙江省",
            "city": "丽水市",
            "venue": "云和",
            "start_date": "2024-11-08",
            "end_date": "2024-11-10",
            "event_status": "completed",
            "result_status": "extended_complete",
            "star_level": "五星 / 5.0",
            "score_coefficient": 5.0,
            "result_source_note": "按本地PDF《成绩册(1).pdf》第27-83页成绩页导入；第1-26页个人积分未导入。",
        },
        "source": {
            "source_id": SOURCE_ID,
            "original_path": str(pdf_path),
            "file_name": pdf_path.name,
            "file_type": "pdf",
            "source_url": source_url(pdf_path.name),
            "parser_name": "parse-yunhe-2024-results.py",
            "parser_status": "parsed",
            "parser_note": "仅解析第27-83页成绩，跳过个人积分页；成人竞速附带预赛/复赛明细不导入。",
            "extracted_rows": len(results),
            "metadata": {
                "page_contexts": contexts,
                "source_kind": "local_result_book",
                "results_only": True,
                "skipped_pages": "1-26个人积分",
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
