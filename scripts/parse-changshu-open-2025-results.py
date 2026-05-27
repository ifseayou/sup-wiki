#!/usr/bin/env python3
"""Parse 2025 中国桨板公开赛（常熟站） result book pages 29-127."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import pdfplumber


EVENT_ID = 278
SOURCE_ID = 339
EVENT_NAME = "2025中国桨板公开赛（常熟站）"
SOURCE_URL = "/result-books/20250628期 中国桨板公开赛常熟站成绩册/2025中国桨板公开赛常熟站成绩册.pdf"
ORIGINAL_PATH = "/Users/xhl/Downloads/桨板赛事/20250628期 中国桨板公开赛常熟站成绩册/2025中国桨板公开赛常熟站成绩册.pdf"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DSQ": "取消成绩",
    "DQ": "取消成绩",
    "DNQ": "未晋级",
    "OTL": "超时关门",
}
STATUS_CODES = set(STATUS_LABELS)


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("—", "-").replace("–", "-")
    return re.sub(r"\s+", " ", text)


def normalize_time(value: str) -> str:
    text = clean(value).upper().strip(".")
    if text in STATUS_CODES:
        return text
    quote = re.fullmatch(r"(\d{1,2})['′](\d{2})[\"”]?(\d{2})", text)
    if quote:
        return f"{int(quote.group(1)):02d}:{quote.group(2)}.{quote.group(3)}"
    return text


def status_code(value: str) -> str | None:
    text = clean(value).upper()
    return text if text in STATUS_CODES else None


def status_note(code: str | None) -> str | None:
    return STATUS_LABELS.get(code or "")


def normalize_group(value: str) -> str:
    text = clean(value)
    replacements = {
        "公开组男子": "公开男子组",
        "公开组女子": "公开女子组",
        "高校组男子": "高校男子组",
        "高校组女子": "高校女子组",
        "大师组男子": "大师男子组",
        "大师组女子": "大师女子组",
        "卡胡纳组男子": "卡胡纳男子组",
        "卡胡纳组女子": "卡胡纳女子组",
    }
    for src, dest in replacements.items():
        text = text.replace(src, dest)
    return text


def normalize_team(value: str | None) -> str:
    text = clean(value or "")
    if not text or text in {"-", "—"}:
        return "个人"
    text = text.replace("有限公 司", "有限公司")
    text = text.replace("发展有限公 司", "发展有限公司")
    return text


def distance_from_group(group: str) -> str:
    return "3公里" if re.search(r"U(?:9|12|15|18)", group, re.I) else "6公里"


def split_finish_tail(text: str) -> tuple[str, str, str | None] | None:
    match = re.search(
        r"\s(DNS|DNF|DSQ|DQ|DNQ|OTL|(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d+)?|\d{1,2}['′]\d{2}[\"”]?\d{2})(?:\s*(?:\(([^)]*)\))?)?(?:\s+(.*))?$",
        clean(text),
        re.I,
    )
    if not match:
        return None
    prefix = text[: match.start()].strip()
    finish = normalize_time(match.group(1))
    note = clean(" ".join(part for part in [match.group(2), match.group(3)] if part)) or None
    return prefix, finish, note


def split_name_team(prefix: str) -> tuple[str, str] | None:
    parts = clean(prefix).split(" ", 1)
    if not parts:
        return None
    name = parts[0]
    team = normalize_team(parts[1] if len(parts) > 1 else "个人")
    return name, team


def is_noise(line: str) -> bool:
    text = clean(line)
    return (
        not text
        or text.startswith(("名次 ", "排名 ", "NO.", "比赛日期", "检录:", "发令:", "裁判长", "水域:", "风力:", "成绩单"))
        or text in {"运动员姓名 代表单位 成绩 备注", "参赛号码 运动员姓名 代表单位 成绩 备注", "参赛号码 运动员姓名 代表单位 成绩 组别", "参赛号码 运动队名称 成绩 备注"}
    )


def long_context(line: str) -> dict[str, Any] | None:
    match = re.search(r"(硬板|充气板)-(.+?)\s+长距离赛\s*成绩单", clean(line))
    if not match:
        return None
    group = normalize_group(match.group(2))
    return {
        "discipline": distance_from_group(group),
        "gender_group": group,
        "board_class": match.group(1),
        "round_label": "决赛",
        "is_team": False,
    }


def race_context(line: str) -> dict[str, Any] | None:
    text = clean(line)
    match = re.search(r"NO\.\d+\s+(200m竞速赛|1km技术赛)(硬板|充气板)-(.+?)(预赛\d*|决赛|秩序单)", text)
    if not match:
        return None
    group = normalize_group(match.group(3))
    round_label = match.group(4)
    if round_label == "秩序单":
        round_label = "决赛"
    return {
        "discipline": "200米" if "200m" in match.group(1) else "1公里技术赛",
        "gender_group": group,
        "board_class": match.group(2),
        "round_label": round_label,
        "is_team": False,
    }


def team_title_context(line: str) -> dict[str, Any] | None:
    text = clean(line)
    match = re.search(r"(混合四人龙板赛|家庭三人龙板赛|四人龙板赛)\s*(1000m|200m)-成绩单", text)
    if not match:
        return None
    name = match.group(1)
    if "家庭" in name:
        group = "家庭组三人龙板"
    elif "混合" in name:
        group = "混合四人龙板"
    else:
        group = "公开四人龙板"
    return {
        "discipline": "1000米" if match.group(2) == "1000m" else "200米",
        "gender_group": group,
        "board_class": "龙板",
        "round_label": "决赛",
        "is_team": True,
    }


def team_no_context(line: str, current: dict[str, Any] | None) -> dict[str, Any] | None:
    if not current or not current.get("is_team"):
        return current
    text = clean(line)
    match = re.search(r"NO\.[\d-]+\s+(.+)$", text)
    if not match:
        return current
    segment = match.group(1)
    updated = dict(current)
    if "预赛" in segment:
        round_match = re.search(r"预赛\d*", segment)
        updated["round_label"] = round_match.group(0) if round_match else "预赛"
    elif "决赛" in segment:
        updated["round_label"] = "决赛"
    return updated


def make_result(context: dict[str, Any], *, page_number: int, rank_position: int, bib_number: str | None, athlete_name: str, team_name: str, finish_time: str, result_label: str | None = None, source_note: str | None = None, members: list[str] | None = None) -> dict[str, Any]:
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
        "team_members": members or [],
        "points": None,
        "source_locator": f"page:{page_number}",
        "parse_confidence": 0.96,
        "review_status": "confirmed",
        "source_note": source_note or "常熟站成绩册第29-127页重解析",
    }


def parse_individual_line(line: str, current: dict[str, Any], page_number: int, status_order: int, pending_note: str | None) -> tuple[dict[str, Any] | None, int, str | None]:
    text = clean(line)
    match = re.match(r"^(\d{1,3}|/|·)\s+(.+)$", text)
    if not match:
        return None, status_order, pending_note

    rank_token = match.group(1)
    rest = match.group(2)
    round_override = None
    bib_number = None

    if rest.startswith("预赛 "):
        round_override = "预赛"
        parts = rest.split(" ", 2)
        if len(parts) < 3:
            return None, status_order, pending_note
        bib_number = parts[1]
        tail = parts[2]
    else:
        parts = rest.split(" ", 2)
        if len(parts) < 3:
            return None, status_order, pending_note
        if re.fullmatch(r"\d{1,2}", parts[0]) and re.fullmatch(r"[A-Z]?\d{2,4}", parts[1]):
            bib_number = parts[1]
            tail = parts[2]
        elif re.fullmatch(r"[A-Z]?\d{2,4}", parts[0]):
            bib_number = parts[0]
            tail = " ".join(parts[1:])
        else:
            return None, status_order, pending_note

    split = split_finish_tail(tail)
    if not split:
        return None, status_order, pending_note
    prefix, finish, note = split
    name_team = split_name_team(prefix)
    if not name_team:
        return None, status_order, pending_note
    athlete_name, team_name = name_team
    code = status_code(finish)

    if rank_token.isdigit():
        rank_position = int(rank_token)
    else:
        status_order += 1
        rank_position = 9000 + status_order

    result_context = dict(current)
    if round_override:
        result_context["round_label"] = round_override
    label_parts = []
    if pending_note:
        label_parts.append(pending_note)
    if note and note not in {"1", "2", "3", "4", "5", "6", "7", "8"}:
        label_parts.append("晋级" if note == "Q" else note)
    result = make_result(
        result_context,
        page_number=page_number,
        rank_position=rank_position,
        bib_number=bib_number,
        athlete_name=athlete_name,
        team_name=team_name,
        finish_time=finish,
        result_label=" ".join(label_parts) or None,
    )
    if code and not result["result_status_note"]:
        result["result_status_note"] = status_note(code)
    return result, status_order, None


def parse_team_row(row_line: str, current: dict[str, Any], page_number: int, bib_line: str | None, member_line: str | None, status_order: int) -> tuple[dict[str, Any] | None, int]:
    text = clean(row_line)
    bibs = clean(bib_line or "").upper()
    pending_status = None
    if bibs:
        status_match = re.search(r"\s(DNS|DNF|DSQ|DQ)$", bibs)
        if status_match:
            pending_status = status_match.group(1)
            bibs = bibs[: status_match.start()].strip()

    round_override = None
    match = re.match(r"^(\d{1,3}|/|·)\s+(预赛|决赛)?\s*(.+)$", text)
    if not match:
        return None, status_order
    rank_token = match.group(1)
    if match.group(2):
        round_override = match.group(2)
    rest = clean(match.group(3))

    split = split_finish_tail(rest)
    if split:
        prefix, finish, note = split
    elif pending_status:
        parts = rest.split(" ", 1)
        prefix = parts[1] if len(parts) > 1 and re.fullmatch(r"\d{1,2}", parts[0]) else rest
        finish = pending_status
        group_note = re.search(r"\s(\d+组)$", prefix)
        note = group_note.group(1) if group_note else None
        if group_note:
            prefix = prefix[: group_note.start()].strip()
    else:
        return None, status_order

    tokens = prefix.split()
    if len(tokens) > 1 and re.fullmatch(r"\d{1,2}", tokens[0]):
        team_name = " ".join(tokens[1:])
    else:
        team_name = prefix

    if rank_token.isdigit() and not status_code(finish):
        rank_position = int(rank_token)
    elif rank_token.isdigit() and int(rank_token) <= 100:
        rank_position = int(rank_token)
    else:
        status_order += 1
        rank_position = 9000 + status_order

    result_context = dict(current)
    if round_override:
        result_context["round_label"] = round_override
    members = [clean(item) for item in re.split(r"[/／]", clean(member_line or "")) if clean(item)]
    label = note
    if label == "Q":
        label = "晋级"
    return (
        make_result(
            result_context,
            page_number=page_number,
            rank_position=rank_position,
            bib_number=bibs or None,
            athlete_name=normalize_team(team_name),
            team_name=normalize_team(team_name),
            finish_time=finish,
            result_label=label,
            members=members,
        ),
        status_order,
    )


def parse_pdf(pdf_path: Path) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    page_counts: dict[str, int] = {}
    status_counters: dict[str, int] = {}

    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            if page_number < 29 or page_number > 127:
                continue
            text = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
            lines = [clean(line) for line in text.splitlines() if clean(line)]
            current: dict[str, Any] | None = None
            pending_note: str | None = None
            pending_bib_line: str | None = None
            pending_team_row: str | None = None
            last_item: dict[str, Any] | None = None

            def add_result(item: dict[str, Any]) -> None:
                nonlocal last_item
                results.append(item)
                last_item = item
                page_counts[str(page_number)] = page_counts.get(str(page_number), 0) + 1

            for line in lines:
                found = long_context(line) or race_context(line) or team_title_context(line)
                if found:
                    current = found
                    pending_note = None
                    pending_bib_line = None
                    pending_team_row = None
                    continue
                if current and current.get("is_team"):
                    current = team_no_context(line, current)
                if not current or is_noise(line):
                    continue

                key = f"{current['discipline']}|{current['gender_group']}|{current.get('round_label')}"
                status_order = status_counters.get(key, 0)

                if current.get("is_team"):
                    if re.fullmatch(r"[A-Z]?\d+(?:/[A-Z]?\d+)+(?:\s+(?:DNS|DNF|DSQ|DQ))?", line, re.I):
                        pending_bib_line = line
                        pending_team_row = None
                        continue
                    if pending_bib_line and re.match(r"^(\d{1,3}|/|·)\s+", line):
                        pending_team_row = line
                        continue
                    if pending_bib_line and pending_team_row:
                        item, status_order = parse_team_row(pending_team_row, current, page_number, pending_bib_line, line, status_order)
                        status_counters[key] = status_order
                        if item:
                            add_result(item)
                        pending_bib_line = None
                        pending_team_row = None
                        continue
                    if re.match(r"^(\d{1,3}|/|·)\s+(预赛|决赛)?.*(DNS|DNF|DSQ|DQ|DNQ|OTL|\d{1,2}['′]\d{2}|(?:\d{1,2}:)?\d{1,2}:\d{2})", line, re.I):
                        item, status_order = parse_team_row(line, current, page_number, pending_bib_line, None, status_order)
                        status_counters[key] = status_order
                        if item:
                            add_result(item)
                        pending_bib_line = None
                        pending_team_row = None
                    continue

                item, status_order, pending_note = parse_individual_line(line, current, page_number, status_order, pending_note)
                status_counters[key] = status_order
                if item:
                    add_result(item)
                    continue
                if not re.search(r"^(名次|参赛号码|运动员姓名|代表单位|备注|组别)", line):
                    if line == "+20s" and last_item and last_item.get("source_locator") == f"page:{page_number}":
                        last_item["result_label"] = clean(f"{last_item.get('result_label') or ''} +20s")
                    elif line in {"非站姿", "抢航罚时", "+20s", "冲线"}:
                        pending_note = clean(f"{pending_note or ''} {line}")

    return {
        "event": {
            "event_id": EVENT_ID,
            "name": EVENT_NAME,
            "slug": "china-sup-open-changshu-2025",
            "province": "江苏省",
            "city": "常熟市",
            "start_date": "2025-06-28",
            "end_date": "2025-06-29",
        },
        "source": {
            "source_id": SOURCE_ID,
            "file_name": Path(ORIGINAL_PATH).name,
            "source_url": SOURCE_URL,
            "original_path": ORIGINAL_PATH,
            "parser_name": Path(__file__).name,
            "parser_note": "常熟站成绩册第29-127页重解析，包含长距离、200米预决赛、1公里技术赛和龙板成绩；积分页未录入。",
            "metadata": {"page_range": "29-127", "page_counts": page_counts},
        },
        "results": results,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", default=ORIGINAL_PATH)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = parse_pdf(Path(args.pdf))
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"parsed {len(payload['results'])} results -> {args.output}")


if __name__ == "__main__":
    main()
