#!/usr/bin/env python3
"""Parse 2024 中国百城桨板公开赛宁波梅山湾站 result book from page 18 onward."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import pdfplumber


EVENT_ID = 189
SOURCE_ID = 244
EVENT_NAME = "2024中国百城桨板公开赛宁波梅山湾站"
SOURCE_URL = "/result-books/20240927期 中国桨板宁波百城公开赛/20240927期 中国桨板宁波百城公开赛.pdf"
ORIGINAL_PATH = "/Users/xhl/Downloads/桨板赛事/20240927期 中国桨板宁波百城公开赛/20240927期 中国桨板宁波百城公开赛.pdf"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DSQ": "取消成绩",
    "DQ": "取消成绩",
}
STATUS_CODES = set(STATUS_LABELS)


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("（", "(").replace("）", ")")
    return re.sub(r"\s+", " ", text)


def normalize_joined_text(value: str) -> str:
    text = clean(value)
    previous = None
    while previous != text:
        previous = text
        text = re.sub(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])", "", text)
    text = text.replace("有限公 司", "有限公司")
    text = text.replace("发展有限公 司", "发展有限公司")
    text = text.replace("运动发 展", "运动发展")
    return text


def normalize_time(value: str) -> str:
    text = clean(value).upper().rstrip(".")
    if text in STATUS_CODES:
        return text
    dot_time = re.fullmatch(r"(\d{1,2})\.(\d{2})\.(\d{2})", text)
    if dot_time:
        return f"{dot_time.group(1)}:{dot_time.group(2)}.{dot_time.group(3)}"
    if re.fullmatch(r"0:\d{2}:\d{2}", text):
        return text[2:]
    return text


def status_code(value: str) -> str | None:
    text = clean(value).upper()
    return text if text in STATUS_CODES else None


def status_note(code: str | None) -> str | None:
    return STATUS_LABELS.get(code or "")


def context_from_title(line: str) -> dict[str, Any] | None:
    text = clean(line)
    match = re.search(r"NO\.\d+\s+(.+?)(长距离赛|竞速赛决赛)", text, re.I)
    if not match:
        return None
    group = normalize_group(match.group(1))
    event_type = match.group(2)
    if "长距离" in event_type:
        discipline = "3公里" if re.search(r"U(?:12|15|18)", group, re.I) else "6公里"
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
    text = text.replace("公开组男子", "公开男子组")
    text = text.replace("公开组女子", "公开女子组")
    text = text.replace("大师组男子", "大师男子组")
    text = text.replace("大师组女子", "大师女子组")
    text = text.replace("卡胡纳组男子", "卡胡纳男子组")
    text = text.replace("卡胡纳组女子", "卡胡纳女子组")
    return text


def is_noise(line: str) -> bool:
    text = clean(line)
    return (
        not text
        or text.startswith(("长距离赛成绩单", "竞速赛-成绩单", "名次 ", "NO.", "风 向", "裁判长", "裁判长签字", "地点："))
        or text.startswith("水 温")
    )


def is_row_start(line: str) -> bool:
    text = clean(line)
    return bool(
        re.match(r"^\d{1,3}\s+\d{3}\s+", text)
        or re.match(r"^(DNS|DNF|DSQ|DQ)\s+\d{3}\s+", text, re.I)
        or re.match(r"^\d{3}\s+.+\s+(DNS|DNF|DSQ|DQ)$", text, re.I)
    )


def is_team_suffix_fragment(line: str) -> bool:
    text = clean(line)
    return text in {"司", "公司", "展有限公司", "发展有限公司"}


def split_finish_tail(text: str) -> tuple[str, str, str | None] | None:
    match = re.search(
        r"\s(DNS|DNF|DSQ|DQ|\d{1,2}\.\d{2}\.\d{2}|(?:\d{1,2}:)?\d{1,2}:\d{2}(?::\d{2})?\.?|\d{1,2}:\d{2}\.\d{2})(?:\s*(.*))?$",
        clean(text),
        re.I,
    )
    if not match:
        return None
    prefix = text[: match.start()].strip()
    finish = normalize_time(match.group(1))
    note = clean(match.group(2)) or None
    return prefix, finish, note


def split_name_team(prefix: str, external_team: str | None) -> tuple[str, str] | None:
    text = clean(prefix)
    if " MOLOKAI" in text:
        name = text.replace(" MOLOKAI", "").strip()
        return name, "MOLOKAI"
    if external_team:
        return text, normalize_joined_text(external_team)
    parts = text.split(" ", 1)
    if len(parts) < 2:
        return text, "个人"
    return parts[0], normalize_joined_text(parts[1] or "个人")


def make_result(
    context: dict[str, Any],
    *,
    page_number: int,
    rank_position: int,
    bib_number: str,
    athlete_name: str,
    team_name: str,
    finish_time: str,
    result_label: str | None = None,
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
        "team_members": [],
        "points": None,
        "source_locator": f"page:{page_number}",
        "parse_confidence": 0.95,
        "review_status": "confirmed",
        "source_note": "宁波梅山湾百城公开赛成绩册第18页后重解析",
    }


def parse_pdf(pdf_path: Path) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    status_counters: dict[str, int] = {}

    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            if page_number < 18:
                continue
            text = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
            lines = [clean(line) for line in text.splitlines() if clean(line)]
            for line in lines[:6]:
                found = context_from_title(line)
                if found:
                    current = found
                    break
            if not current:
                continue

            counter_key = f"{current['discipline']}|{current['gender_group']}"
            status_counter = status_counters.get(counter_key, 0)
            pending_team_parts: list[str] = []
            active_row: dict[str, Any] | None = None

            def flush_active() -> None:
                nonlocal active_row
                if not active_row:
                    return
                team = normalize_joined_text(" ".join(active_row["team_parts"])) if active_row["team_parts"] else None
                name_team = split_name_team(active_row["prefix"], team)
                if not name_team:
                    active_row = None
                    return
                athlete_name, team_name = name_team
                results.append(
                    make_result(
                        current,
                        page_number=page_number,
                        rank_position=active_row["rank"],
                        bib_number=active_row["bib"],
                        athlete_name=athlete_name,
                        team_name=team_name,
                        finish_time=active_row["finish_time"],
                        result_label=active_row.get("result_label"),
                    )
                )
                active_row = None

            for line in lines:
                if is_noise(line):
                    continue
                if is_row_start(line):
                    flush_active()
                    ranked = re.match(r"^(\d{1,3})\s+(\d{3})\s+(.+)$", line)
                    status_first = None if ranked else re.match(r"^(DNS|DNF|DSQ|DQ)\s+(\d{3})\s+(.+)$", line, re.I)
                    plain_status = None if ranked or status_first else re.match(r"^(\d{3})\s+(.+)$", line)
                    if ranked:
                        rank = int(ranked.group(1))
                        bib = ranked.group(2)
                        rest = ranked.group(3)
                    elif status_first:
                        status_counter += 1
                        rank = 9000 + status_counter
                        bib = status_first.group(2)
                        rest = status_first.group(3)
                    elif plain_status:
                        tail_check = split_finish_tail(plain_status.group(2))
                        if not tail_check or not status_code(tail_check[1]):
                            pending_team_parts.append(line)
                            continue
                        status_counter += 1
                        rank = 9000 + status_counter
                        bib = plain_status.group(1)
                        rest = plain_status.group(2)
                    else:
                        continue
                    tail = split_finish_tail(rest)
                    if not tail:
                        pending_team_parts.append(line)
                        continue
                    prefix, finish_time, note = tail
                    has_external_team = bool(pending_team_parts)
                    active_row = {
                        "rank": rank,
                        "bib": bib,
                        "prefix": prefix,
                        "finish_time": finish_time,
                        "result_label": note,
                        "team_parts": pending_team_parts,
                    }
                    pending_team_parts = []
                    if not has_external_team:
                        flush_active()
                else:
                    if active_row:
                        if is_team_suffix_fragment(line):
                            active_row["team_parts"].append(line)
                            flush_active()
                        else:
                            flush_active()
                            pending_team_parts.append(line)
                    else:
                        pending_team_parts.append(line)
            flush_active()
            status_counters[counter_key] = status_counter

    return {
        "event": {
            "event_id": EVENT_ID,
            "name": EVENT_NAME,
            "start_date": "2024-09-28",
            "end_date": "2024-09-28",
            "province": "浙江省",
            "city": "宁波市",
            "venue": "宁波梅山湾",
        },
        "duplicate_event_id": 241,
        "duplicate_source_id": 301,
        "source": {
            "source_id": SOURCE_ID,
            "file_name": "20240927期 中国桨板宁波百城公开赛.pdf",
            "source_url": SOURCE_URL,
            "original_path": ORIGINAL_PATH,
            "parser_name": "parse-ningbo-baicheng-2024-results.py",
            "parser_note": "从第18页开始解析成绩单，成人长距离为6公里，青少年U12/U15/U18长距离为3公里。",
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
