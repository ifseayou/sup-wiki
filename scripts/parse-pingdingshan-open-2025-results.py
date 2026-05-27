#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_NAME = "2025年中国桨板公开赛（平顶山站）"
EVENT_SLUG = "china-sup-open-pingdingshan-2025"
SOURCE_URL = "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/result-submissions/393/1779893115946-8fbhmp-tmp_b49c504c5eca52503ab02469e5051823.pdf"
PDF_PATH = Path("/tmp/sup-wiki-race-import/submission-393.pdf")
FILE_NAME = "2025年中国桨板公开赛（平顶山站）成绩册.pdf"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
    "DNQ": "未晋级",
    "OTL": "超过关门时间",
}
STATUS_CODES = set(STATUS_LABELS)


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("：", ":").replace("（", "(").replace("）", ")")
    return re.sub(r"\s+", " ", text)


def normalize_time(value: str) -> str:
    text = clean(value).upper()
    if text in STATUS_CODES:
        return text
    text = text.replace("′", ":").replace("’", ":").replace("'", ":").replace('"', "")
    return text


def status_code(value: str) -> str | None:
    code = clean(value).upper()
    return code if code in STATUS_CODES else None


def status_note(code: str | None) -> str | None:
    return STATUS_LABELS.get(code or "")


def normalize_group(value: str) -> str:
    text = clean(value)
    text = text.replace(" ", "")
    return text


def board_class(group: str, discipline: str) -> str | None:
    if "龙板" in discipline:
        return "龙板"
    if "充气板" in group:
        return "充气板"
    if "硬板" in group:
        return "硬板"
    return None


def normalize_team(value: str) -> str:
    text = clean(value)
    if not text or text in {"-", "—", "/"}:
        return "个人"
    return text


def is_time_or_status(value: str) -> bool:
    text = normalize_time(value)
    return bool(
        status_code(text)
        or text == "#N/A"
        or re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?", text)
    )


def is_noise(line: str) -> bool:
    text = clean(line)
    return (
        not text
        or text.startswith(("中国桨板公开赛", "名次 ", "No.", "NO.", "*晋级规则", "总裁判长", "检录:"))
        or text in {"耐力赛成绩单", "成绩单"}
    )


def result_from_parts(
    context: dict[str, Any],
    *,
    page_number: int,
    rank_position: int,
    bib_number: str | None,
    athlete_name: str,
    team_name: str,
    finish_time: str,
    result_label: str | None = None,
    result_status_code: str | None = None,
    team_members: list[str] | None = None,
) -> dict[str, Any]:
    finish = normalize_time(finish_time)
    code = result_status_code or status_code(finish)
    return {
        "athlete_name_snapshot": clean(athlete_name),
        "bib_number": clean(bib_number),
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class") or board_class(context["gender_group"], context["discipline"]),
        "round_label": context.get("round_label") or "决赛",
        "rank_position": rank_position,
        "result_label": clean(result_label) or None,
        "finish_time": finish,
        "result_status_code": code,
        "result_status_note": status_note(code),
        "time_seconds": None,
        "points": None,
        "team_name": normalize_team(team_name),
        "team_members": team_members or [],
        "nationality_snapshot": "中国",
        "source_locator": f"page:{page_number}",
        "source_url": SOURCE_URL,
        "source_note": context.get("source_note") or f"{context['gender_group']} {context['discipline']}",
        "parse_confidence": context.get("parse_confidence", 0.98),
        "review_status": "confirmed",
        "is_verified": True,
    }


def line_context(lines: list[str]) -> dict[str, Any] | None:
    title = " ".join(lines[:5])
    group_match = re.search(r"(男子|女子)(充气板|硬板)(U\d+组|高校组|公开组|大师组|卡胡纳组)", title)
    if not group_match:
        return None
    group = normalize_group("".join(group_match.groups()))
    if "耐力赛" in title:
        discipline = "耐力赛"
    elif "冲刺赛" in title:
        discipline = "冲刺赛"
    elif "技术赛" in title:
        discipline = "技术赛"
    else:
        return None
    return {
        "discipline": discipline,
        "gender_group": group,
        "board_class": group_match.group(2),
        "round_label": "决赛",
        "source_note": f"{group} {discipline}",
        "parse_confidence": 0.98,
    }


def split_individual_tail(tail: str) -> tuple[str, str, str, str | None, str | None] | None:
    tokens = clean(tail).split()
    if len(tokens) < 3:
        return None
    finish = None
    note_parts: list[str] = []
    for index in range(len(tokens) - 1, 0, -1):
        token = normalize_time(tokens[index])
        if not is_time_or_status(token):
            continue
        code_override = None
        if token == "#N/A":
            if index + 1 < len(tokens) and status_code(tokens[index + 1]):
                finish = normalize_time(tokens[index + 1])
                code_override = status_code(tokens[index + 1])
                note_parts = ["#N/A"]
                prefix = tokens[:index]
            else:
                continue
        elif status_code(token) and index > 0 and tokens[index - 1] == "#N/A":
            finish = token
            code_override = status_code(token)
            note_parts = ["#N/A"]
            prefix = tokens[: index - 1]
        elif status_code(token) and index > 0 and status_code(tokens[index - 1]):
            finish = token
            code_override = status_code(token)
            note_parts = [normalize_time(tokens[index - 1])]
            prefix = tokens[: index - 1]
        elif status_code(token) and index > 0 and re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?", normalize_time(tokens[index - 1])):
            finish = normalize_time(tokens[index - 1])
            code_override = status_code(token)
            note_parts = [token]
            prefix = tokens[: index - 1]
        elif index + 1 < len(tokens) and status_code(tokens[index + 1]):
            finish = token if re.match(r"\d", token) else normalize_time(tokens[index + 1])
            code_override = status_code(tokens[index + 1])
            note_parts = [normalize_time(tokens[index + 1])]
            prefix = tokens[:index]
        else:
            finish = token
            note_parts = tokens[index + 1 :]
            prefix = tokens[:index]
        if len(prefix) < 2:
            continue
        note = clean(" ".join(part for part in note_parts if not re.fullmatch(r"0\.\d+", part)))
        return prefix[0], clean(" ".join(prefix[1:])), finish, note or None, code_override
    return None


def parse_individual_line(line: str, context: dict[str, Any], page_number: int, status_index: int) -> tuple[dict[str, Any] | None, int]:
    text = clean(line)
    if is_noise(text):
        return None, status_index

    match = re.match(r"^(\d{1,3})\s+(?:预赛\s+)?([A-Z]?\d{2,5})\s+(.+)$", text)
    round_label = context.get("round_label") or "决赛"
    rank: int | None = None
    bib: str | None = None
    tail = ""
    if match:
        rank = int(match.group(1))
        bib = match.group(2)
        tail = match.group(3)
        if " 预赛 " in f" {text} ":
            round_label = "预赛"
    else:
        match = re.match(r"^(\d{1,3})\s+\d{1,2}\s+([A-Z]?\d{2,5})\s+(.+)$", text)
        if match:
            rank = int(match.group(1))
            bib = match.group(2)
            tail = match.group(3)
        else:
            match = re.match(r"^预赛\s+([A-Z]?\d{2,5})\s+(.+)$", text)
            if match:
                status_index += 1
                rank = 9000 + status_index
                round_label = "预赛"
                bib = match.group(1)
                tail = match.group(2)
            else:
                return None, status_index

    split = split_individual_tail(tail)
    if not split or rank is None:
        return None, status_index
    name, team, finish, note, code_override = split
    row_context = {**context, "round_label": round_label}
    return result_from_parts(
        row_context,
        page_number=page_number,
        rank_position=rank,
        bib_number=bib,
        athlete_name=name,
        team_name=team,
        finish_time=finish,
        result_label=note,
        result_status_code=code_override,
    ), status_index


def dragon_context_from_line(line: str, current: dict[str, Any] | None) -> dict[str, Any] | None:
    text = clean(line)
    if "四人龙板赛" in text:
        return {
            "discipline": "四人龙板赛",
            "gender_group": "公开组",
            "board_class": "龙板",
            "round_label": current.get("round_label", "决赛") if current else "决赛",
            "source_note": "四人龙板赛",
            "parse_confidence": 0.96,
        }
    if "家庭龙板赛" in text:
        return {
            "discipline": "家庭龙板赛",
            "gender_group": "家庭组",
            "board_class": "龙板",
            "round_label": current.get("round_label", "决赛") if current else "决赛",
            "source_note": "家庭龙板赛",
            "parse_confidence": 0.96,
        }
    if current and re.search(r"NO\.\d+\s+预赛", text):
        updated = dict(current)
        round_match = re.search(r"预赛\d*/\d*", text)
        updated["round_label"] = round_match.group(0) if round_match else "预赛"
        return updated
    if current and re.search(r"NO\.\d+\s+决赛", text):
        updated = dict(current)
        updated["round_label"] = "决赛"
        return updated
    return current


def split_bibs_team_finish(line: str) -> tuple[str, str, str, str | None] | None:
    tokens = clean(line).split()
    if len(tokens) < 3:
        return None
    bibs = tokens[0]
    for index in range(len(tokens) - 1, 0, -1):
        finish = normalize_time(tokens[index])
        if not is_time_or_status(finish):
            continue
        team = clean(" ".join(tokens[1:index]))
        note = clean(" ".join(tokens[index + 1 :])) or None
        return bibs, team, finish, note
    if re.fullmatch(r"(?:[A-Z]?\d{2,5}/?)+", bibs):
        return bibs, clean(" ".join(tokens[1:])), "未记录", "原表未给成绩"
    return None


def parse_dragon_pages(reader: PdfReader) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for page_number in range(88, 93):
        lines = [clean(line) for line in (reader.pages[page_number - 1].extract_text() or "").splitlines() if clean(line)]
        current: dict[str, Any] | None = None
        index = 0
        status_index = 0
        while index < len(lines):
            line = lines[index]
            next_context = dragon_context_from_line(line, current)
            if next_context is not current:
                current = next_context
                index += 1
                continue
            if not current or is_noise(line):
                index += 1
                continue
            match = re.match(r"^(\d{1,3})\s+(?:(\d{1,2})\s+)?(.+/.+)$", line)
            if not match:
                index += 1
                continue
            rank = int(match.group(1))
            names = clean(match.group(3))
            if index + 1 >= len(lines):
                break
            split = split_bibs_team_finish(lines[index + 1])
            if not split:
                index += 1
                continue
            bibs, team, finish, note = split
            if finish == "未记录":
                status_index += 1
                rank = 9000 + status_index
            members = [clean(item) for item in names.split("/") if clean(item)]
            out.append(
                result_from_parts(
                    current,
                    page_number=page_number,
                    rank_position=rank,
                    bib_number=bibs,
                    athlete_name=members[0] if members else names,
                    team_name=team,
                    finish_time=finish,
                    result_label=note,
                    team_members=members,
                )
            )
            index += 2
    return out


def parse_pdf(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    if len(reader.pages) != 92:
        raise ValueError(f"Expected 92 pages, got {len(reader.pages)}")
    results: list[dict[str, Any]] = []
    status_by_context: dict[str, int] = {}
    for page_number in range(27, 88):
        lines = [clean(line) for line in (reader.pages[page_number - 1].extract_text() or "").splitlines() if clean(line)]
        context = line_context(lines)
        if not context:
            raise ValueError(f"Missing context on page {page_number}")
        key = f"{context['discipline']}|{context['gender_group']}"
        status_by_context.setdefault(key, 0)
        for line in lines:
            parsed, status_by_context[key] = parse_individual_line(line, context, page_number, status_by_context[key])
            if parsed:
                results.append(parsed)
    results.extend(parse_dragon_pages(reader))
    modules = sorted({f"{row['discipline']} · {row['gender_group']}" for row in results})
    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "start_date": "2025-10-18",
            "end_date": "2025-10-19",
            "province": "河南省",
            "city": "平顶山市",
            "venue": "白龟湖国家城市湿地公园",
            "event_status": "completed",
            "result_status": "extended_complete",
            "source_scope": "用户提交成绩册导入",
            "result_source_note": "仅导入第27-92页成绩，跳过第2-26页个人及团体积分。",
        },
        "source": {
            "original_path": str(path),
            "file_name": FILE_NAME,
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "parser_name": "parse-pingdingshan-open-2025-results.py",
            "parser_status": "parsed",
            "parser_note": "抽取第27-87页个人耐力/冲刺/技术赛成绩及第88-92页龙板赛成绩；未导入第2-26页积分。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "result_submission",
                "submission_id": 9,
                "result_submission_folder": 393,
                "page_range": "27-92",
                "excluded_pages": "2-26积分页",
                "modules": modules,
            },
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=PDF_PATH)
    parser.add_argument("-o", "--output", type=Path, default=Path(".cache/pingdingshan-open-2025-results.json"))
    args = parser.parse_args()
    payload = parse_pdf(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    statuses: dict[str, int] = {}
    modules: dict[str, int] = {}
    for row in payload["results"]:
        statuses[row.get("result_status_code") or "OK"] = statuses.get(row.get("result_status_code") or "OK", 0) + 1
        key = f"{row['discipline']} · {row['gender_group']}"
        modules[key] = modules.get(key, 0) + 1
    print(f"results={len(payload['results'])} modules={len(modules)} statuses={statuses} output={args.output}")


if __name__ == "__main__":
    main()
