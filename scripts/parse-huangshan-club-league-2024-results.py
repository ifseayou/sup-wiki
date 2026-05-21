#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_NAME = "2024中国桨板俱乐部联赛黄山站"
EVENT_SLUG = "china-sup-club-league-huangshan-2024"
BASE_DIR = Path("/Users/xhl/Downloads/桨板赛事/20241116 中国桨板俱乐部联赛黄山站")
PUBLIC_DIR = "20241116 中国桨板俱乐部联赛黄山站"

FILES = [
    {
        "key": "long",
        "file_name": "长距离成绩(非正式).pdf",
        "kind": "long",
        "note": "黄山站长距离成绩，文件标注为非正式。",
    },
    {
        "key": "sprint_prelim",
        "file_name": "竞速赛-预赛-成绩单.pdf",
        "kind": "sprint_prelim",
        "note": "黄山站竞速赛预赛成绩单。",
    },
    {
        "key": "sprint_final",
        "file_name": "竞速赛-决赛成绩单.pdf",
        "kind": "sprint_final",
        "note": "黄山站竞速赛决赛成绩单。",
    },
]

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
    "DNQ": "未晋级",
    "OTL": "超时关门",
}
STATUS_CODES = set(STATUS_LABELS)


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalize_group(value: str) -> str:
    text = clean(value)
    replacements = {
        "公开组男子": "公开男子组",
        "公开组女子": "公开女子组",
        "大师组男子": "大师男子组",
        "大师组女子": "大师女子组",
        "卡胡纳组男子": "卡胡纳男子组",
        "卡胡纳组女子": "卡胡纳女子组",
        "高校组女子": "高校女子组",
    }
    if text in replacements:
        return replacements[text]
    match = re.fullmatch(r"U(\d+)组(男子|女子)", text)
    if match:
        return f"U{match.group(1)}{match.group(2)}组"
    return text


def status_code(value: str) -> str | None:
    text = clean(value).upper()
    if text == "关门":
        return "OTL"
    return text if text in STATUS_CODES else None


def normalize_time(value: str) -> str:
    text = clean(value).upper().replace("：", ":")
    if text in STATUS_CODES:
        return text
    if text == "关门":
        return "关门"
    return text


def time_seconds(value: str) -> float | None:
    text = normalize_time(value)
    if status_code(text) or text == "关门":
        return None
    if not re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?", text):
        return None
    parts = text.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    except ValueError:
        return None
    return None


def is_result_value(value: str) -> bool:
    text = clean(value)
    return bool(
        status_code(text)
        or text == "关门"
        or re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?", text)
        or re.fullmatch(r"预赛小组第[三四五六七八九十]+", text)
    )


def is_result_fragment(value: str) -> bool:
    text = clean(value)
    return bool(is_result_value(text) or re.match(r"^\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:\s+Q)?$", text))


def result_from_parts(
    context: dict[str, Any],
    *,
    source_key: str,
    page_number: int,
    rank_position: int,
    bib_number: str,
    athlete_name: str,
    team_name: str,
    finish_time: str,
    result_label: str | None = None,
    source_note: str | None = None,
) -> dict[str, Any]:
    finish = normalize_time(finish_time)
    code = status_code(finish)
    return {
        "source_key": source_key,
        "athlete_name_snapshot": clean(athlete_name),
        "bib_number": clean(bib_number),
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context["board_class"],
        "round_label": context["round_label"],
        "rank_position": rank_position,
        "result_label": clean(result_label) or None,
        "finish_time": finish,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code),
        "time_seconds": time_seconds(finish),
        "points": None,
        "team_name": clean(team_name) or "个人",
        "team_members": [],
        "source_locator": f"page:{page_number}",
        "source_note": source_note or context["source_note"],
        "parse_confidence": 0.98,
        "review_status": "confirmed",
    }


def split_name_team_result(rest: str) -> tuple[str, str, str, str | None] | None:
    value = clean(rest)
    tokens = value.split()
    for index in range(len(tokens) - 1, 0, -1):
        candidate = tokens[index]
        if not is_result_value(candidate):
            continue
        prefix = tokens[:index]
        note = clean(" ".join(tokens[index + 1:])) or None
        if len(prefix) < 2:
            continue
        return prefix[0], clean(" ".join(prefix[1:])), candidate, note
    return None


def normalize_lines(text: str) -> list[str]:
    lines = [clean(line) for line in text.splitlines() if clean(line)]
    out: list[str] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        if out and is_result_fragment(line) and not is_result_value(out[-1].split()[-1]):
            out[-1] = clean(f"{out[-1]} {line}")
            index += 1
            continue
        if (
            out
            and not re.match(r"^(No\.|NO\.|名次|公示时间|/\*|竞速赛|长距离赛)", line, re.I)
            and not re.match(r"^(?:\d+\s+)?(?:\d{1,2}\s+)?\d{3}\s+", line)
            and not is_result_value(line)
        ):
            out[-1] = clean(f"{out[-1]}{line}")
            index += 1
            continue
        out.append(line)
        index += 1
    return out


def context_from_title(title: str, kind: str) -> dict[str, Any] | None:
    text = clean(title)
    if kind == "long":
        match = re.search(r"([^\s]+?)([36])km长距离赛决赛", text)
        if not match:
            return None
        group = normalize_group(match.group(1))
        return {
            "discipline": f"{match.group(2)}公里",
            "gender_group": group,
            "board_class": "卡胡纳" if "卡胡纳" in group else None,
            "round_label": "决赛",
            "source_note": text,
        }
    match = re.search(r"(.+?)竞速赛(预赛第\d+组|决赛)", text)
    if not match:
        return None
    group = normalize_group(match.group(1).split()[-1])
    return {
        "discipline": "200米",
        "gender_group": group,
        "board_class": "卡胡纳" if "卡胡纳" in group else None,
        "round_label": match.group(2),
        "source_note": text,
    }


def parse_long_row(line: str, context: dict[str, Any], source_key: str, page_number: int, status_index: int) -> tuple[dict[str, Any] | None, int]:
    ranked = re.match(r"^(\d{1,3})\s+(\d{3})\s+(.+)$", line)
    if ranked:
        rank_raw, bib, rest = ranked.groups()
        split = split_name_team_result(rest)
        if not split:
            return None, status_index
        name, team, finish, note = split
        return result_from_parts(context, source_key=source_key, page_number=page_number, rank_position=int(rank_raw), bib_number=bib, athlete_name=name, team_name=team, finish_time=finish, result_label=note), status_index

    status = re.match(r"^(\d{3})\s+(.+)$", line)
    if not status:
        return None, status_index
    bib, rest = status.groups()
    split = split_name_team_result(rest)
    if not split:
        return None, status_index
    name, team, finish, note = split
    status_index += 1
    return result_from_parts(context, source_key=source_key, page_number=page_number, rank_position=9000 + status_index, bib_number=bib, athlete_name=name, team_name=team, finish_time=finish, result_label=note), status_index


def parse_prelim_row(line: str, context: dict[str, Any], source_key: str, page_number: int, status_index: int) -> tuple[dict[str, Any] | None, int]:
    ranked = re.match(r"^(\d{1,3})\s+\d{1,2}\s+(\d{3})\s+(.+)$", line)
    if ranked:
        rank_raw, bib, rest = ranked.groups()
        split = split_name_team_result(rest)
        if split:
            name, team, finish, note = split
            return result_from_parts(context, source_key=source_key, page_number=page_number, rank_position=int(rank_raw), bib_number=bib, athlete_name=name, team_name=team, finish_time=finish, result_label=note), status_index

    status = re.match(r"^\d{1,2}\s+(\d{3})\s+(.+)$", line)
    if not status:
        return None, status_index
    bib, rest = status.groups()
    split = split_name_team_result(rest)
    if not split:
        return None, status_index
    name, team, finish, note = split
    status_index += 1
    return result_from_parts(context, source_key=source_key, page_number=page_number, rank_position=9000 + status_index, bib_number=bib, athlete_name=name, team_name=team, finish_time=finish, result_label=note), status_index


def parse_final_row(line: str, context: dict[str, Any], source_key: str, page_number: int, status_index: int) -> tuple[dict[str, Any] | None, int]:
    ranked = re.match(r"^(\d{1,3})\s+(?:\d{1,2}\s+)?(\d{3})\s+(.+)$", line)
    if ranked:
        rank_raw, bib, rest = ranked.groups()
        split = split_name_team_result(rest)
        if split:
            name, team, finish, note = split
            label = note or (finish if finish.startswith("预赛小组") else None)
            return result_from_parts(context, source_key=source_key, page_number=page_number, rank_position=int(rank_raw), bib_number=bib, athlete_name=name, team_name=team, finish_time=finish, result_label=label), status_index

    status = re.match(r"^(?:\d{1,2}\s+)?(\d{3})\s+(.+)$", line)
    if not status:
        return None, status_index
    bib, rest = status.groups()
    split = split_name_team_result(rest)
    if not split:
        return None, status_index
    name, team, finish, note = split
    status_index += 1
    return result_from_parts(context, source_key=source_key, page_number=page_number, rank_position=9000 + status_index, bib_number=bib, athlete_name=name, team_name=team, finish_time=finish, result_label=note), status_index


def parse_pdf(file_info: dict[str, str]) -> list[dict[str, Any]]:
    path = BASE_DIR / file_info["file_name"]
    reader = PdfReader(str(path))
    rows: list[dict[str, Any]] = []
    for page_number, page in enumerate(reader.pages, start=1):
        context: dict[str, Any] | None = None
        status_index = 0
        for line in normalize_lines(page.extract_text() or ""):
            if not line or line.startswith(("竞速赛-", "长距离赛-", "名次 ", "公示时间", "/*")):
                continue
            if re.match(r"^(No\.|NO\.)", line, re.I):
                context = context_from_title(line, file_info["kind"])
                if not context:
                    raise ValueError(f"Cannot parse title in {file_info['file_name']} page {page_number}: {line}")
                continue
            if not context:
                continue
            if file_info["kind"] == "long":
                parsed, status_index = parse_long_row(line, context, file_info["key"], page_number, status_index)
            elif file_info["kind"] == "sprint_prelim":
                parsed, status_index = parse_prelim_row(line, context, file_info["key"], page_number, status_index)
            else:
                parsed, status_index = parse_final_row(line, context, file_info["key"], page_number, status_index)
            if parsed:
                rows.append(parsed)
            elif re.search(r"\d{3}", line):
                raise ValueError(f"Unparsed row in {file_info['file_name']} page {page_number}: {line}")
    return rows


def build_payload() -> dict[str, Any]:
    sources = []
    results = []
    for file_info in FILES:
        path = BASE_DIR / file_info["file_name"]
        parsed = parse_pdf(file_info)
        sources.append({
            "source_key": file_info["key"],
            "original_path": str(path),
            "file_name": file_info["file_name"],
            "file_type": "pdf",
            "source_url": f"/result-books/{PUBLIC_DIR}/{file_info['file_name']}",
            "parser_name": "parse-huangshan-club-league-2024-results.py",
            "parser_status": "parsed",
            "parser_note": file_info["note"],
            "extracted_rows": len(parsed),
            "imported_rows": len(parsed),
            "metadata": {
                "source_kind": "local_result_book",
                "relative_path": f"{PUBLIC_DIR}/{file_info['file_name']}",
                "event_key": EVENT_SLUG,
            },
        })
        results.extend(parsed)

    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "start_date": "2024-11-16",
            "end_date": "2024-11-17",
            "province": "安徽省",
            "city": "黄山市",
            "venue": "安徽黄山",
            "event_status": "completed",
            "result_status": "extended_complete",
            "source_scope": "三份本地成绩单导入",
            "result_source_note": "黄山站三份成绩单合并导入：长距离、竞速预赛、竞速决赛。",
        },
        "sources": sources,
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("-o", "--output", type=Path, default=Path(".cache/huangshan-club-league-2024-results.json"))
    args = parser.parse_args()
    payload = build_payload()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"results={len(payload['results'])} sources={len(payload['sources'])} output={args.output}")
    for source in payload["sources"]:
        print(f"{source['source_key']}: {source['extracted_rows']} rows")


if __name__ == "__main__":
    main()
