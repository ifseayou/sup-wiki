#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_NAME = "西太湖第三届水上运动季 2025年中国百城桨板公开赛（常州站）"
SOURCE_URL = "/result-books/20250926 中国百城桨板公开赛常州站/2025年中国百城桨板公开赛（常州站）成绩册(1).pdf"
STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
    "DNQ": "未晋级",
    "OTL": "超过关门时间",
}
STATUS_CODES = set(STATUS_LABELS)

RESULT_PAGE_GROUPS = {
    3: "公开男子组",
    4: "公开男子组",
    5: "公开女子组",
    6: "大师男子组",
    7: "大师女子组",
    8: "卡胡纳男子组",
    9: "卡胡纳女子组",
    10: "高校男子组",
    11: "高校女子组",
    12: "U15男子组",
    13: "U15女子组",
    14: "U12男子组",
    15: "U12女子组",
    16: "U9男子组",
    17: "U9女子组",
    18: "U15男子组",
    19: "U15女子组",
    20: "U12男子组",
    21: "U12女子组",
    22: "U9男子组",
    23: "U9女子组",
    24: "公开男子组",
    25: "公开男子组",
    26: "公开女子组",
    27: "大师男子组",
    28: "大师女子组",
    29: "卡胡纳男子组",
    30: "卡胡纳女子组",
    31: "高校男子组",
    32: "高校女子组",
}

POINT_PAGE_GROUPS = {
    35: ["公开男子组"],
    36: ["公开男子组"],
    37: ["公开女子组"],
    38: ["大师男子组"],
    39: ["大师女子组"],
    40: ["卡胡纳男子组"],
    41: ["卡胡纳女子组"],
    42: ["高校男子组", "高校女子组"],
    43: ["U15男子组", "U15女子组"],
    44: ["U12男子组", "U12女子组"],
    45: ["U9男子组", "U9女子组"],
}


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalize_time(value: str) -> str:
    text = clean(value).upper().replace("：", ":")
    if text in STATUS_CODES:
        return text
    text = text.replace("'", ":").replace("’", ":").replace("′", ":").replace('"', "")
    return text


def status_code(value: str) -> str | None:
    code = clean(value).upper()
    return code if code in STATUS_CODES else None


def status_note(code: str | None) -> str | None:
    return STATUS_LABELS.get(code or "")


def board_class(group_name: str, discipline: str) -> str | None:
    if "卡胡纳" in group_name:
        return "卡胡纳"
    if "龙板" in discipline:
        return "龙板"
    return None


def parse_number(value: str) -> float | None:
    text = clean(value)
    if not text or text == "/" or text.upper() in STATUS_CODES:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_rank(value: str) -> int | None:
    text = clean(value)
    if re.fullmatch(r"\d{1,4}", text):
        return int(text)
    return None


def split_name_team_finish(rest: str) -> tuple[str, str, str, str | None] | None:
    value = clean(rest)
    match = re.search(r"\s((?:\d{1,2}:)?\d{1,2}[:.]\d{2}(?:[:.]\d{1,3})?|DNS|DNF|DQ|DSQ|DNQ|OTL)(?:\s+(.*))?$", value, re.I)
    if not match:
        return None
    finish = normalize_time(match.group(1))
    note = clean(match.group(2))
    prefix = value[: match.start()].strip()
    parts = prefix.split(" ", 1)
    if len(parts) < 2:
        return None
    return parts[0], parts[1] or "个人", finish, note or None


def parse_score_rows(text: str, page_number: int) -> list[dict[str, Any]]:
    group = RESULT_PAGE_GROUPS.get(page_number)
    if not group:
        return []
    discipline = "200米" if 18 <= page_number <= 32 else "3公里" if page_number >= 12 and page_number <= 17 else "6公里"
    out: list[dict[str, Any]] = []
    status_sequence = 0
    for raw in text.splitlines():
        line = clean(raw)
        if not line or line.startswith("名次 ") or line.startswith("NO.") or "成绩单" in line:
            continue

        # Sprint pages only keep final rows: ranked rows without 预赛/半决赛 labels.
        if discipline == "200米":
            if re.match(r"^\d+\s+(预赛|半决赛)\s+", line) or line.startswith("/"):
                continue
            match = re.match(r"^(\d{1,3})\s+([A-Z]?\d{3,5})\s+(.+)$", line)
            if not match:
                continue
            rank_raw, bib, rest = match.groups()
        else:
            match = re.match(r"^(\d{1,3})\s+([A-Z]?\d{3,5})\s+(.+)$", line)
            if match:
                rank_raw, bib, rest = match.groups()
            else:
                status_match = re.match(r"^/\s+/\s+([A-Z]?\d{3,5})\s+(.+)$", line)
                if not status_match:
                    continue
                bib, rest = status_match.groups()
                status_sequence += 1
                rank_raw = str(9000 + status_sequence)

        split = split_name_team_finish(rest)
        if not split:
            continue
        name, team, finish, note = split
        code = status_code(finish)
        out.append({
            "athlete_name_snapshot": name,
            "bib_number": bib,
            "gender_group": group,
            "discipline": discipline,
            "board_class": board_class(group, discipline),
            "round_label": "决赛",
            "rank_position": int(rank_raw),
            "result_label": note,
            "finish_time": finish,
            "result_status_code": code,
            "result_status_note": status_note(code),
            "team_name": team or "个人",
            "team_members": [],
            "points": None,
            "source_locator": f"page:{page_number}",
            "parse_confidence": 0.98,
            "review_status": "confirmed",
            "source_note": "常州站 PDF 分段解析",
        })
    return out


def parse_dragon_page(text: str, page_number: int, discipline: str) -> list[dict[str, Any]]:
    lines = [clean(line) for line in text.splitlines() if clean(line)]
    out: list[dict[str, Any]] = []
    index = 0
    status_sequence = 0
    while index < len(lines):
        match = re.match(r"^(\d{1,3}|/)\s+((?:[A-Z]?\d{2,5}/?)+)$", lines[index])
        if not match or index + 1 >= len(lines):
            index += 1
            continue
        rank_raw, bibs = match.groups()
        detail = lines[index + 1]
        split = split_name_team_finish(detail)
        if not split:
            index += 1
            continue
        members_raw, team, finish, note = split
        if rank_raw == "/" and status_code(finish):
            status_sequence += 1
            rank = 9000 + status_sequence
        elif rank_raw.isdigit():
            rank = int(rank_raw)
        else:
            index += 1
            continue
        if discipline == "混合龙板赛" and "预赛" in detail:
            index += 2
            continue
        members = [item.strip() for item in members_raw.split("/") if item.strip()]
        code = status_code(finish)
        out.append({
            "athlete_name_snapshot": team,
            "bib_number": bibs,
            "gender_group": "龙板组",
            "discipline": discipline,
            "board_class": "龙板",
            "round_label": "决赛",
            "rank_position": rank,
            "result_label": note,
            "finish_time": finish,
            "result_status_code": code,
            "result_status_note": status_note(code),
            "team_name": team,
            "team_members": members,
            "points": None,
            "source_locator": f"page:{page_number}",
            "parse_confidence": 0.98,
            "review_status": "confirmed",
            "source_note": "常州站 PDF 龙板分段解析",
        })
        index += 2
    return out


def split_point_blocks(text: str) -> list[list[str]]:
    lines = [clean(line) for line in text.splitlines() if clean(line)]
    header_indexes = [idx for idx, line in enumerate(lines) if line.startswith("名次 参赛号 姓名 单位")]
    blocks: list[list[str]] = []
    for pos, start in enumerate(header_indexes):
        end = header_indexes[pos + 1] if pos + 1 < len(header_indexes) else len(lines)
        rows = []
        for line in lines[start + 1:end]:
            if line.startswith("西太湖") or line.startswith("2025年") or line.startswith("选手个人赛积分") or line.startswith("总积分"):
                continue
            if re.fullmatch(r".+组", line) or line == "总裁判长签字：":
                continue
            rows.append(line)
        if rows:
            blocks.append(rows)
    return blocks


def parse_point_row(line: str, group_name: str, page_number: int) -> dict[str, Any] | None:
    match = re.match(r"^(\d{1,3}|DNS|DNF|DSQ|DQ|DNQ|OTL)\s+([A-Z]?\d{3,5})\s+(.+?)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$", line, re.I)
    if not match:
        return None
    rank_raw, bib, prefix, endurance_rank, endurance_points, sprint_rank, sprint_points, total_points = match.groups()
    parts = prefix.rsplit(" ", 1)
    if len(parts) != 2:
        return None
    name, team = parts
    return {
        "group_name": group_name,
        "rank_position": parse_rank(rank_raw),
        "status_rank": None if parse_rank(rank_raw) is not None else rank_raw.upper(),
        "bib_number": bib,
        "athlete_name_snapshot": name,
        "team_name": team or "个人",
        "endurance_rank": endurance_rank,
        "endurance_points": parse_number(endurance_points),
        "sprint_rank": sprint_rank,
        "sprint_points": parse_number(sprint_points),
        "total_points": parse_number(total_points),
        "source_locator": f"page:{page_number}",
    }


def parse_points(text: str, page_number: int) -> list[dict[str, Any]]:
    groups = POINT_PAGE_GROUPS.get(page_number, [])
    blocks = split_point_blocks(text)
    out: list[dict[str, Any]] = []
    for index, rows in enumerate(blocks):
        if index >= len(groups):
            continue
        group_name = groups[index]
        for row in rows:
            parsed = parse_point_row(row, group_name, page_number)
            if parsed:
                out.append(parsed)
    return out


def parse_pdf(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    results: list[dict[str, Any]] = []
    points: list[dict[str, Any]] = []
    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if 3 <= page_number <= 32:
            results.extend(parse_score_rows(text, page_number))
        elif page_number == 33:
            results.extend(parse_dragon_page(text, page_number, "混合龙板赛"))
        elif page_number == 34:
            results.extend(parse_dragon_page(text, page_number, "家庭龙板赛"))
        elif 35 <= page_number <= 45:
            points.extend(parse_points(text, page_number))
    return {
        "event": {
            "event_id": 297,
            "name": EVENT_NAME,
            "start_date": "2025-09-27",
            "end_date": "2025-09-28",
            "province": "江苏省",
            "city": "常州市",
            "venue": "西太湖",
            "event_status": "completed",
            "result_status": "extended_complete",
        },
        "source": {
            "original_path": str(path),
            "file_name": path.name,
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "parser_name": "parse-changzhou-2025-results.py",
            "parser_status": "parsed",
            "parser_note": "常州站 PDF 定向分段解析，200米仅保留决赛成绩。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "local_result_book",
                "event_key": "changzhou-2025-baicheng",
                "point_rows": len(points),
            },
        },
        "results": results,
        "point_standings": points,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("-o", "--output", type=Path, default=Path(".cache/changzhou-2025-results.json"))
    args = parser.parse_args()
    payload = parse_pdf(args.pdf)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"results={len(payload['results'])} point_standings={len(payload['point_standings'])} output={args.output}")


if __name__ == "__main__":
    main()
