#!/usr/bin/env python3
"""Parse 2025 "苏河湾" 上海桨板公开赛 result PDF."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import pdfplumber


EVENT_ID = 267
SOURCE_ID = 328
EVENT_NAME = "2025“苏河湾”上海桨板公开赛"
SOURCE_URL = "/result-books/20250525 苏河湾 上海桨板公开赛/成绩册-2025“苏河湾”上海桨板公开赛.pdf"
ORIGINAL_PATH = "/Users/xhl/Downloads/桨板赛事/20250525 苏河湾 上海桨板公开赛/成绩册-2025“苏河湾”上海桨板公开赛.pdf"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DSQ": "取消成绩",
    "DQ": "取消成绩",
}


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("：", ":").replace("．", ".")
    return re.sub(r"\s+", " ", text)


def normalize_finish(value: str) -> str:
    text = clean(value).upper().rstrip(".")
    if text in STATUS_LABELS:
        return text
    match = re.fullmatch(r"(\d{1,2})['′](\d{2})[\"”](\d{2})", text)
    if match:
        return f"{int(match.group(1)):02d}:{match.group(2)}.{match.group(3)}"
    return text


def normalize_group(value: str) -> str:
    text = clean(value)
    patterns = [
        ("男子大师组", "大师男子组"),
        ("女子大师组", "大师女子组"),
        ("男子公开组", "公开男子组"),
        ("女子公开组", "公开女子组"),
        ("男子U12组", "U12组男子"),
        ("女子U12组", "U12组女子"),
        ("男子U15组", "U15组男子"),
        ("女子U15组", "U15组女子"),
        ("男子U12", "U12组男子"),
        ("女子U12", "U12组女子"),
        ("男子U15", "U15组男子"),
        ("女子U15", "U15组女子"),
    ]
    for source, target in patterns:
        text = text.replace(source, target)
    return text


def parse_title(line: str) -> dict[str, Any] | None:
    title = clean(line)
    match = re.match(r"NO\.(\d+)\s+(.+?)\s+时间[:：]\s*([0-9/]+)\s+([0-9:]+)", title)
    if not match:
        return None
    no = int(match.group(1))
    name = match.group(2)
    date = match.group(3)
    time = match.group(4)
    context: dict[str, Any] = {
        "no": no,
        "date": date,
        "time": time,
        "source_note": f"NO.{no} {name} 时间:{date} {time}",
    }
    if "龙板长距离赛" in name:
        context.update({"discipline": "龙板长距离赛", "gender_group": "公开组", "round_label": "决赛", "board_class": "龙板", "team": True})
    elif "企业组长距离赛" in name:
        context.update({"discipline": "企业组长距离赛", "gender_group": "企业组", "round_label": "决赛", "board_class": "龙板", "team": True})
    elif "接力赛" in name:
        round_label = name.replace("接力赛", "")
        context.update({"discipline": "接力赛", "gender_group": "公开组", "round_label": round_label or "决赛", "board_class": "接力", "team": True})
    elif "长距离赛" in name:
        context.update({"discipline": "长距离", "gender_group": normalize_group(name.replace("长距离赛", "")), "round_label": "决赛", "board_class": None, "team": False})
    elif name.startswith("直道竞速"):
        body = name.replace("直道竞速", "")
        group, round_label = split_group_round(body)
        context.update({"discipline": "直道竞速", "gender_group": group, "round_label": round_label, "board_class": None, "team": False})
    elif name.startswith("绕标赛"):
        body = name.replace("绕标赛", "")
        group, round_label = split_group_round(body)
        context.update({"discipline": "绕标赛", "gender_group": group, "round_label": round_label, "board_class": None, "team": False})
    else:
        return None
    return context


def split_group_round(body: str) -> tuple[str, str]:
    match = re.match(r"(.+?)(预赛\d+|半决赛\d+|决赛)$", clean(body))
    if match:
        return normalize_group(match.group(1)), match.group(2)
    return normalize_group(body), "决赛"


def label_from_text(text: str) -> str | None:
    labels: list[str] = []
    if re.search(r"\b[Qq]\b", text):
        labels.append("晋级")
    fine = re.search(r"罚时\s*(\d+\s*s)?", text, re.I)
    if fine:
        labels.append(f"罚时{clean(fine.group(1) or '')}".strip())
    if "更正" in text:
        labels.append("更正")
    return "；".join(labels) or None


def is_noise(line: str) -> bool:
    text = clean(line)
    if not text:
        return True
    return bool(
        text in {"成绩单", "长距离赛成绩单"}
        or text.startswith("名次 ")
        or text.startswith("/*晋级规则")
        or text.startswith("水温:")
        or text.startswith("裁判长")
        or re.fullmatch(r"\d{1,2}", text)
    )


def split_members(text: str) -> list[str]:
    return [clean(item) for item in re.split(r"[/／]", text) if clean(item)]


def parse_individual_line(line: str, context: dict[str, Any], page_number: int, state: dict[str, Any]) -> dict[str, Any] | None:
    text = clean(line)
    if is_noise(text) or text.startswith("NO."):
        return None

    time_pattern = r"(?:\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,2})?|\d{1,2}['′]\d{2}[\"”]\d{2}|DNS|DNF|DSQ|DQ)"
    if context["discipline"] == "长距离":
        match = re.match(rf"^(\d+)\s+([A-Z]\d{{3}})\s+(\S+)\s+(.+?)\s+({time_pattern})(?:\s+(.*))?$", text, re.I)
        if not match:
            return None
        rank = int(match.group(1))
        bib = match.group(2)
        name = match.group(3)
        team = clean(match.group(4)) or "个人"
        finish = normalize_finish(match.group(5))
        extra = clean(match.group(6))
        state["last_rank"] = rank
        source_note = context["source_note"]
    else:
        match = re.match(rf"^(\d+)\s+(\d+)\s+([A-Z]\d{{3}})\s+(\S+)\s+(.+?)\s+({time_pattern})(?:\s+(.*))?$", text, re.I)
        source_note = context["source_note"]
        if match:
            rank = int(match.group(1))
            lane = match.group(2)
            bib = match.group(3)
            name = match.group(4)
            team = clean(match.group(5)) or "个人"
            finish = normalize_finish(match.group(6))
            extra = clean(match.group(7))
            state["last_rank"] = max(state.get("last_rank", 0), rank)
            source_note = f"{source_note}; 出发位置:{lane}"
        else:
            status_match = re.match(rf"^(\d+)\s+([A-Z]\d{{3}})\s+(\S+)\s+(.+?)\s+({time_pattern})(?:\s+(.*))?$", text, re.I)
            if not status_match:
                return None
            state["last_rank"] = state.get("last_rank", 0) + 1
            rank = state["last_rank"]
            lane = status_match.group(1)
            bib = status_match.group(2)
            name = status_match.group(3)
            team = clean(status_match.group(4)) or "个人"
            finish = normalize_finish(status_match.group(5))
            extra = clean(status_match.group(6))
            source_note = f"{source_note}; PDF未给名次, 按本组顺序补位; 出发位置:{lane}"

    code = finish if finish in STATUS_LABELS else None
    return {
        "athlete_name_snapshot": name,
        "bib_number": bib,
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class"),
        "round_label": context["round_label"],
        "rank_position": rank,
        "result_label": label_from_text(extra),
        "finish_time": finish,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code),
        "team_name": team or "个人",
        "source_locator": f"page:{page_number}",
        "source_note": source_note,
        "parse_confidence": 0.98,
        "review_status": "confirmed",
    }


def parse_team_sections(lines: list[str], context: dict[str, Any], page_number: int) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    index = 0
    pending_bibs = ""
    pending_team_prefix = ""
    pending_label = ""
    while index < len(lines):
        line = clean(lines[index])
        index += 1
        if is_noise(line) or line.startswith("NO."):
            continue
        if re.search(r"[A-Z]\d{3}/", line) or re.fullmatch(r"[A-Z]\d{3}(?:/[A-Z]\d{3})+", line):
            codes = re.findall(r"[A-Z]\d{3}", line)
            prefix = clean(re.sub(r"[A-Z]\d{3}(?:/[A-Z]\d{3})*", "", line))
            prefix = clean(re.sub(r"\b[Qq]\b", "", prefix))
            pending_bibs = "/".join(codes)
            pending_team_prefix = prefix
            pending_label = label_from_text(line) or ""
            continue

        used_prefix_in_match = False
        match = re.match(r"^(\d+)\s+(?:(\d+)\s+)?(.+?)\s+(\d{1,2}['′]\d{2}[\"”]\d{2}|\d{1,2}:\d{2}(?:\.\d{1,2})?|DNS|DNF|DSQ|DQ)(?:\s+(.*))?$", line, re.I)
        if not match and pending_team_prefix:
            short_match = re.match(r"^(\d+)\s+(\d{1,2}['′]\d{2}[\"”]\d{2}|\d{1,2}:\d{2}(?:\.\d{1,2})?|DNS|DNF|DSQ|DQ)(?:\s+(.*))?$", line, re.I)
            if short_match:
                match = re.match(
                    r"^(\d+)\s+(?:(\d+)\s+)?(.+?)\s+(\d{1,2}['′]\d{2}[\"”]\d{2}|\d{1,2}:\d{2}(?:\.\d{1,2})?|DNS|DNF|DSQ|DQ)(?:\s+(.*))?$",
                    f"{short_match.group(1)} {pending_team_prefix} {short_match.group(2)} {short_match.group(3) or ''}",
                    re.I,
                )
                used_prefix_in_match = True
        if not match:
            continue

        rank = int(match.group(1))
        lane = match.group(2)
        team_name = clean(match.group(3))
        finish = normalize_finish(match.group(4))
        extra = clean(match.group(5))
        members_line = ""
        if index < len(lines):
            members_line = clean(lines[index])
            index += 1
        if re.fullmatch(r"\d+\s*s", members_line, re.I):
            extra = clean(f"{extra} {members_line}")
            members_line = clean(lines[index]) if index < len(lines) else ""
            index += 1 if members_line else 0

        if pending_team_prefix and not used_prefix_in_match:
            team_name = clean(f"{pending_team_prefix} {team_name}")
        if "有限公司 " in members_line:
            prefix, names = members_line.split("有限公司 ", 1)
            if pending_team_prefix:
                team_name = clean(f"{pending_team_prefix}{prefix}有限公司")
            members_line = names
        if index < len(lines) and re.fullmatch(r"\d+\s*s", clean(lines[index]), re.I):
            extra = clean(f"{extra} {lines[index]}")
            index += 1

        label_parts = [part for part in [pending_label, label_from_text(extra)] if part]
        code = finish if finish in STATUS_LABELS else None
        source_note = context["source_note"]
        if lane:
            source_note = f"{source_note}; 出发位置:{lane}"
        results.append(
            {
                "athlete_name_snapshot": team_name,
                "bib_number": pending_bibs or None,
                "gender_group": context["gender_group"],
                "discipline": context["discipline"],
                "board_class": context.get("board_class"),
                "round_label": context["round_label"],
                "rank_position": rank,
                "result_label": "；".join(dict.fromkeys(label_parts)) or None,
                "finish_time": finish,
                "result_status_code": code,
                "result_status_note": STATUS_LABELS.get(code),
                "team_name": team_name,
                "team_members": split_members(members_line),
                "source_locator": f"page:{page_number}",
                "source_note": source_note,
                "parse_confidence": 0.96,
                "review_status": "confirmed",
            }
        )
        pending_bibs = ""
        pending_team_prefix = ""
        pending_label = ""
    return results


def parse_pdf(pdf_path: Path) -> dict[str, Any]:
    pages: list[dict[str, Any]] = []
    results: list[dict[str, Any]] = []
    context: dict[str, Any] | None = None
    section_state: dict[str, dict[str, int]] = {}

    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number in range(2, len(pdf.pages) + 1):
            text = pdf.pages[page_number - 1].extract_text() or ""
            lines = [clean(line) for line in text.splitlines() if clean(line)]
            pages.append({"page": page_number, "lines": len(lines)})

            if any(line.startswith("NO.") for line in lines):
                segments: list[tuple[dict[str, Any], list[str]]] = []
                current_context: dict[str, Any] | None = None
                current_lines: list[str] = []
                for line in lines:
                    title_context = parse_title(line) if line.startswith("NO.") else None
                    if title_context:
                        if current_context:
                            segments.append((current_context, current_lines))
                        current_context = title_context
                        current_lines = []
                        context = title_context
                    else:
                        current_lines.append(line)
                if current_context:
                    segments.append((current_context, current_lines))
            elif context:
                segments = [(context, lines)]
            else:
                segments = []

            for segment_context, segment_lines in segments:
                if segment_context.get("team"):
                    results.extend(parse_team_sections(segment_lines, segment_context, page_number))
                    continue
                key = f"{segment_context['discipline']}|{segment_context['gender_group']}|{segment_context['round_label']}"
                state = section_state.setdefault(key, {"last_rank": 0})
                for line in segment_lines:
                    row = parse_individual_line(line, segment_context, page_number, state)
                    if row:
                        results.append(row)

    return {
        "event": {
            "event_id": EVENT_ID,
            "name": EVENT_NAME,
            "slug": "suhewan-shanghai-sup-open-2025",
            "province": "上海市",
            "city": "上海市",
            "start_date": "2025-05-24",
            "end_date": "2025-05-25",
        },
        "source": {
            "source_id": SOURCE_ID,
            "file_name": pdf_path.name,
            "source_url": SOURCE_URL,
            "original_path": str(pdf_path),
            "parser_name": Path(__file__).name,
            "parser_note": "苏河湾上海桨板公开赛成绩册第2-57页重解析；仅录入成绩目录中的成绩单，不录入积分。",
            "metadata": {"pages": pages, "page_range": "2-57"},
        },
        "results": dedupe(results),
    }


def dedupe(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    unique: list[dict[str, Any]] = []
    for row in rows:
        key = (
            row["discipline"],
            row["gender_group"],
            row.get("round_label"),
            row["rank_position"],
            row["athlete_name_snapshot"],
            row.get("bib_number"),
            row.get("source_locator"),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", default=ORIGINAL_PATH)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    payload = parse_pdf(Path(args.pdf))
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    team_rows = sum(1 for row in payload["results"] if row.get("team_members"))
    print(f"wrote {len(payload['results'])} rows, team rows {team_rows}: {args.output}")
    grouped: dict[str, int] = {}
    for row in payload["results"]:
        key = f"{row['discipline']} · {row['gender_group']} · {row.get('round_label') or '-'}"
        grouped[key] = grouped.get(key, 0) + 1
    for key, count in sorted(grouped.items()):
        print(f"{count:4d}  {key}")


if __name__ == "__main__":
    main()
