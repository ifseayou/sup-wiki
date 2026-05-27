#!/usr/bin/env python3
"""Parse the 2024 青田国际桨板公开赛 result book from page 26 onward."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_ID = 244
SOURCE_ID = 304
EVENT_NAME = "2024青田国际桨板公开赛"
SOURCE_URL = "/result-books/20241019期 青田国际桨板公开赛/成绩册.pdf"
ORIGINAL_PATH = "/Users/xhl/Downloads/桨板赛事/20241019期 青田国际桨板公开赛/成绩册.pdf"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
    "DNQ": "未晋级",
    "OTL": "超过关门时间",
}
STATUS_CODES = set(STATUS_LABELS)
CHINESE_STATUS_CODES = {
    "关门": "OTL",
}


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("：", ":").replace("（", "(").replace("）", ")")
    return re.sub(r"\s+", " ", text)


def normalize_team_name(value: str) -> str:
    text = clean(value)
    previous = None
    while previous != text:
        previous = text
        text = re.sub(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])", "", text)
    return text or "个人"


def normalize_time(value: str) -> str:
    text = clean(value).upper()
    if text in CHINESE_STATUS_CODES:
        return CHINESE_STATUS_CODES[text]
    if text in STATUS_CODES:
        return text
    quote_time = re.fullmatch(r"(\d{1,2})['’′](\d{2})[\"”]?(\d{2})", text)
    if quote_time:
        return f"{quote_time.group(1).zfill(2)}:{quote_time.group(2)}.{quote_time.group(3)}"
    return (
        text.replace("'", ":")
        .replace("’", ":")
        .replace("′", ":")
        .replace('"', "")
        .replace("”", "")
        .replace("“", "")
    )


def status_code(value: str) -> str | None:
    text = clean(value).upper()
    if text in CHINESE_STATUS_CODES:
        return CHINESE_STATUS_CODES[text]
    return text if text in STATUS_CODES else None


def status_note(code: str | None) -> str | None:
    return STATUS_LABELS.get(code or "")


def split_members(value: str) -> list[str]:
    return [item.strip() for item in re.split(r"[/、,，;；]+", value) if item.strip()]


def context_from_header(line: str) -> dict[str, Any] | None:
    text = clean(line)
    if not re.search(r"\bNo?\.?\d+|NO\.\d+", text, re.I):
        return None

    round_label = "决赛" if "决赛" in text or "Final" in text else None
    board_class = None
    discipline = ""
    gender_group = ""
    is_team = False

    if "团体接力赛" in text:
        return {"discipline": "团体接力赛", "gender_group": "团体组", "board_class": None, "round_label": round_label, "is_team": True}
    if "团体龙板赛" in text:
        return {"discipline": "团体龙板赛", "gender_group": "龙板组", "board_class": "龙板", "round_label": round_label, "is_team": True}

    if "趴板赛" in text:
        discipline = "趴板赛"
    elif "竞速赛" in text or "Sprint" in text:
        discipline = "200米"
    elif "3km" in text.lower() or "3公里" in text:
        discipline = "3公里"
    elif "6km" in text.lower() or "6公里" in text:
        discipline = "6公里"
    else:
        return None

    group_match = re.search(r"((?:U\d+|公开|大师|卡胡纳|高校)组?\s*(?:男子|女子)?|(?:男子|女子)(?:公开|大师|卡胡纳|高校)组)", text, re.I)
    if group_match:
        gender_group = group_match.group(1)
    else:
        gender_group = "公开组"

    gender_group = normalize_group(gender_group)
    if "卡胡纳" in gender_group:
        board_class = "卡胡纳"

    return {
        "discipline": discipline,
        "gender_group": gender_group,
        "board_class": board_class,
        "round_label": round_label,
        "is_team": is_team,
    }


def normalize_group(value: str) -> str:
    text = clean(value).replace(" ", "")
    text = re.sub(r"男子(公开|大师|卡胡纳|高校)组", r"\1组男子", text)
    text = re.sub(r"女子(公开|大师|卡胡纳|高校)组", r"\1组女子", text)
    if re.fullmatch(r"(U\d+)组?男子", text):
        return re.sub(r"(U\d+)组?男子", r"\1组男子", text)
    if re.fullmatch(r"(U\d+)组?女子", text):
        return re.sub(r"(U\d+)组?女子", r"\1组女子", text)
    if re.fullmatch(r"(公开|大师|卡胡纳|高校)组?男子", text):
        return re.sub(r"(公开|大师|卡胡纳|高校)组?男子", r"\1组男子", text)
    if re.fullmatch(r"(公开|大师|卡胡纳|高校)组?女子", text):
        return re.sub(r"(公开|大师|卡胡纳|高校)组?女子", r"\1组女子", text)
    return text


def is_noise(line: str) -> bool:
    return (
        not line
        or line.startswith("RESULT")
        or line.startswith("RANK ")
        or line.startswith("名次 ")
        or line.startswith("Chief Referee")
        or line.startswith("水温")
        or line.startswith("检录长")
        or line.startswith("总裁判长")
        or line.startswith("地点:")
        or line.startswith("地点：")
    )


def row_starts(line: str, is_team: bool) -> bool:
    if is_team:
        return bool(re.match(r"^\d{1,3}\s+\d+\s+", line) or re.match(r"^\d+\s+\S+", line))
    return bool(
        re.match(r"^\d{1,3}\s+(?:\d{1,2}\s+)?[A-Z]\d{3}\s+", line)
        or re.match(r"^[A-Z]\d{3}\s+", line)
        or re.match(r"^(?:DNS|DNF|DQ|DSQ|DNQ|OTL|关门)\s+[A-Z]\d{3}\s+", line, re.I)
    )


def split_blocks(page_text: str) -> list[tuple[dict[str, Any], list[str]]]:
    blocks: list[tuple[dict[str, Any], list[str]]] = []
    current: dict[str, Any] | None = None
    lines: list[str] = []

    for raw in page_text.splitlines():
        line = clean(raw)
        next_context = context_from_header(line)
        if next_context:
            if current and lines:
                blocks.append((current, lines))
            current = next_context
            lines = []
            continue
        if not current or is_noise(line):
            continue
        lines.append(line)

    if current and lines:
        blocks.append((current, lines))
    return blocks


def group_row_lines(lines: list[str], is_team: bool) -> list[str]:
    rows: list[str] = []
    current = ""
    for line in lines:
        if row_starts(line, is_team):
            if current:
                rows.append(current)
            current = line
        elif current:
            current = f"{current} {line}"
    if current:
        rows.append(current)
    return rows


def split_name_team_finish(rest: str) -> tuple[str, str, str, str | None] | None:
    value = clean(rest)
    finish_match = re.search(
        r"\s((?:\d{1,2}:)?\d{1,2}[:.]\d{2}(?:[:.]\d{1,3})?|DNS|DNF|DQ|DSQ|DNQ|OTL|关门)(?:\s+(.*))?$",
        value,
        re.I,
    )
    if not finish_match:
        return None
    finish = normalize_time(finish_match.group(1))
    note = clean(finish_match.group(2))
    prefix = value[: finish_match.start()].strip()
    for personal_marker in ("个人/Individual", "个人"):
        marker_index = prefix.rfind(f" {personal_marker}")
        if marker_index > 0:
            name = prefix[:marker_index].strip()
            team = prefix[marker_index + 1 :].strip()
            return name, team or "个人", finish, note or None
    parts = prefix.split(" ", 1)
    if len(parts) < 2:
        return None
    return parts[0], parts[1] or "个人", finish, note or None


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
        "team_name": normalize_team_name(team_name),
        "team_members": team_members or [],
        "points": None,
        "source_locator": f"page:{page_number}",
        "parse_confidence": 0.96,
        "review_status": "confirmed",
        "source_note": "2024青田成绩册文本重解析",
    }


def parse_individual_rows(context: dict[str, Any], rows: list[str], page_number: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    status_sequence = 0
    for row in rows:
        ranked = re.match(r"^(\d{1,3})\s+(?:\d{1,2}\s+)?([A-Z]\d{3})\s+(.+)$", row)
        status = None if ranked else re.match(r"^([A-Z]\d{3})\s+(.+)$", row)
        status_first = None if ranked or status else re.match(r"^(DNS|DNF|DQ|DSQ|DNQ|OTL|关门)\s+([A-Z]\d{3})\s+(.+)$", row, re.I)
        if ranked:
            rank = int(ranked.group(1))
            bib = ranked.group(2)
            rest = ranked.group(3)
        elif status:
            bib = status.group(1)
            rest = status.group(2)
            split_for_status = split_name_team_finish(rest)
            if not split_for_status or not status_code(split_for_status[2]):
                continue
            status_sequence += 1
            rank = 9000 + status_sequence
        elif status_first:
            bib = status_first.group(2)
            rest = f"{status_first.group(3)} {status_first.group(1)}"
            status_sequence += 1
            rank = 9000 + status_sequence
        else:
            continue
        split = split_name_team_finish(rest)
        if not split:
            continue
        name, team, finish, note = split
        if context["discipline"] in {"200米", "趴板赛"} and note and re.search(r"预赛|复赛", note):
            continue
        out.append(
            make_result(
                context,
                page_number=page_number,
                rank_position=rank,
                bib_number=bib,
                athlete_name=name,
                team_name=team,
                finish_time=finish,
                result_label=note,
            )
        )
    return out


def parse_team_rows(context: dict[str, Any], rows: list[str], page_number: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    status_sequence = 0
    for row in rows:
        match = re.match(r"^(\d{1,3})\s+\d+\s+(.+?)\s+((?:[A-Z]\d{3}/?)+)\s+((?:\d{1,2}:)?\d{2}[:']\d{2}[\"”]?\d{2}|DNS|DNF|DQ|DSQ|DNQ|OTL|关门)(?:\s+(.*))?$", row, re.I)
        status_match = None if match else re.match(r"^\d+\s+(.+?)\s+((?:[A-Z]\d{3}/?)+)\s+((?:\d{1,2}:)?\d{2}[:']\d{2}[\"”]?\d{2}|DNS|DNF|DQ|DSQ|DNQ|OTL|关门)(?:\s+(.*))?$", row, re.I)
        if match:
            rank_raw, detail, bibs, finish_raw, note = match.groups()
        elif status_match:
            rank_raw = None
            detail, bibs, finish_raw, note = status_match.groups()
        else:
            continue
        finish = normalize_time(finish_raw)
        if rank_raw is None or status_code(finish):
            status_sequence += 1
            rank = 9000 + status_sequence
        else:
            rank = int(rank_raw)
        team, members_raw = split_team_detail(detail)
        members = split_members(members_raw)
        primary = members[0] if members else team
        out.append(
            make_result(
                context,
                page_number=page_number,
                rank_position=rank,
                bib_number=bibs,
                athlete_name=primary,
                team_name=team,
                finish_time=finish,
                result_label=clean(note) or None,
                team_members=members,
            )
        )
    return out


def split_team_detail(detail: str) -> tuple[str, str]:
    text = clean(detail)
    slash_pos = text.find("/")
    if slash_pos < 0:
        return text, ""
    left = text[:slash_pos]
    first_member_start = left.rfind(" ")
    if first_member_start < 0:
        return "团队", text
    team = left[:first_member_start].strip()
    members = text[first_member_start + 1 :].strip()
    return team or "团队", members


def parse_pdf(pdf_path: Path) -> dict[str, Any]:
    reader = PdfReader(str(pdf_path))
    results: list[dict[str, Any]] = []
    for page_number in range(26, len(reader.pages) + 1):
        text = reader.pages[page_number - 1].extract_text() or ""
        for context, lines in split_blocks(text):
            grouped = group_row_lines(lines, bool(context.get("is_team")))
            if context.get("is_team"):
                results.extend(parse_team_rows(context, grouped, page_number))
            else:
                results.extend(parse_individual_rows(context, grouped, page_number))

    return {
        "event": {
            "event_id": EVENT_ID,
            "name": EVENT_NAME,
            "start_date": "2024-10-19",
            "end_date": "2024-10-19",
            "province": "浙江省",
            "city": "丽水市",
            "venue": "浙江青田",
        },
        "source": {
            "source_id": SOURCE_ID,
            "file_name": "成绩册.pdf",
            "source_url": SOURCE_URL,
            "original_path": ORIGINAL_PATH,
            "parser_name": "parse-qingtian-2024-results.py",
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
        group_key = " / ".join([row["discipline"], row["gender_group"], row.get("board_class") or "-"])
        groups[group_key] = groups.get(group_key, 0) + 1
        pages[row["source_locator"]] = pages.get(row["source_locator"], 0) + 1
    print(json.dumps({"rows": len(payload["results"]), "groups": groups, "pages": pages}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
