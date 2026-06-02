#!/usr/bin/env python3
"""Parse ICF SUP World Championships MemoSoft result books.

The ICF PDFs are text PDFs, but their row order differs by year:
2025 uses Rank/Lane/NF/Name/Time, while the 2024 sprint book uses
Rank/Time/Year/NF/Lane/Bib/Name. This parser keeps official English
event/group/round labels and never generates points.
"""

from __future__ import annotations

import argparse
import collections
import json
import re
from pathlib import Path
from typing import Any

import fitz


REPO_ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = REPO_ROOT / ".cache" / "icf-sup-worlds"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
    "DQB": "取消参赛资格",
    "DNQ": "未晋级",
}
STATUS_CODES = set(STATUS_LABELS)
COUNTRY_RE = re.compile(r"^[A-Z]{3}$")
TIME_RE = re.compile(r"^\d+(?::\d{2}){0,2}\.\d{1,3}$")
BEHIND_RE = re.compile(r"^\+\d+(?::\d{2}){0,2}\.\d{1,3}$")
YEAR_RE = re.compile(r"^(19|20)\d{2}$")
NUMBER_RE = re.compile(r"^\d+$")
TITLE_RE = re.compile(
    r"^(Sprint|Technical|Long distance|Inflatable SUP)\b.+(?:\s-\s.+)?$",
    re.IGNORECASE,
)
LONG_DISTANCE_TITLE_RE = re.compile(r"^Long distance\b.+$", re.IGNORECASE)


COUNTRY_TO_CHINESE = {
    "AIN": "中立个人运动员",
    "ARG": "阿根廷",
    "AUS": "澳大利亚",
    "AUT": "奥地利",
    "BAN": "孟加拉国",
    "BEL": "比利时",
    "BRA": "巴西",
    "BUL": "保加利亚",
    "CAN": "加拿大",
    "CHI": "智利",
    "CHN": "中国",
    "COL": "哥伦比亚",
    "CRC": "哥斯达黎加",
    "CYP": "塞浦路斯",
    "CZE": "捷克",
    "DEN": "丹麦",
    "EGY": "埃及",
    "ESP": "西班牙",
    "FIN": "芬兰",
    "FRA": "法国",
    "GBR": "英国",
    "GER": "德国",
    "GRE": "希腊",
    "GUA": "危地马拉",
    "HKG": "中国香港",
    "HUN": "匈牙利",
    "ICF": "ICF代表队",
    "INA": "印度尼西亚",
    "IND": "印度",
    "IRI": "伊朗",
    "IRL": "爱尔兰",
    "ISR": "以色列",
    "ITA": "意大利",
    "JPN": "日本",
    "KOR": "韩国",
    "MAS": "马来西亚",
    "MEX": "墨西哥",
    "NED": "荷兰",
    "NOR": "挪威",
    "NZL": "新西兰",
    "PAK": "巴基斯坦",
    "PAN": "巴拿马",
    "PER": "秘鲁",
    "PHI": "菲律宾",
    "POL": "波兰",
    "POR": "葡萄牙",
    "PUR": "波多黎各",
    "ROU": "罗马尼亚",
    "RSA": "南非",
    "RUS": "俄罗斯",
    "SGP": "新加坡",
    "SLO": "斯洛文尼亚",
    "SRB": "塞尔维亚",
    "SUI": "瑞士",
    "SVK": "斯洛伐克",
    "SWE": "瑞典",
    "THA": "泰国",
    "TPE": "中国台北",
    "TUR": "土耳其",
    "UAE": "阿联酋",
    "UKR": "乌克兰",
    "USA": "美国",
}


EVENTS = {
    "2025": {
        "event": {
            "name": "2025 ICF SUP World Championships",
            "name_en": "2025 ICF SUP World Championships",
            "slug": "icf-sup-world-championships-2025",
            "province": "United Arab Emirates",
            "city": "Abu Dhabi",
            "venue": "Abu Dhabi",
            "start_date": "2025-10-29",
            "end_date": "2025-11-02",
            "description": "ICF official SUP World Championships results imported from the official MemoSoft result book.",
            "star_level": "world",
            "score_coefficient": None,
            "source_scope": "ICF官方成绩册导入",
            "result_source_note": "仅录入ICF官方成绩册中的比赛成绩；不录入积分、奖牌榜或汇总榜。",
        },
        "pdf": CACHE_DIR / "2025supwchfullresults.pdf",
        "url": "https://www.canoeicf.com/sites/default/files/2025supwchfullresults.pdf",
        "file_name": "2025supwchfullresults.pdf",
        "parser_note": "Parsed pages 1-136 from the 2025 ICF SUP World Championships official full result book; medal/ranking summaries excluded if present.",
        "format": "2025",
    },
    "2024": {
        "event": {
            "name": "2024 ICF SUP World Championships - Sprint",
            "name_en": "2024 ICF SUP World Championships - Sprint",
            "slug": "icf-sup-world-championships-sprint-2024",
            "province": "USA",
            "city": "Sarasota",
            "venue": "Sarasota, USA",
            "start_date": "2024-11-20",
            "end_date": "2024-11-24",
            "description": "ICF official SUP World Championships sprint results imported from the official MemoSoft result book.",
            "star_level": "world",
            "score_coefficient": None,
            "source_scope": "ICF官方成绩册导入",
            "result_source_note": "仅录入ICF官方Sprint成绩册中的比赛成绩；不录入积分、奖牌榜或汇总榜。",
        },
        "pdf": CACHE_DIR / "2024_icf_sup_wch_sprint.pdf",
        "url": "https://www.canoeicf.com/sites/default/files/2024_icf_sup_wch_sprint.pdf",
        "file_name": "2024_icf_sup_wch_sprint.pdf",
        "parser_note": "Parsed pages 1-69 from the 2024 ICF SUP World Championships sprint result book.",
        "format": "2024",
        "verify_only": True,
    },
    "2024-technical": {
        "event": {
            "name": "2024 ICF SUP World Championships - Technical",
            "name_en": "2024 ICF SUP World Championships - Technical",
            "slug": "icf-sup-world-championships-technical-2024",
            "province": "USA",
            "city": "Sarasota",
            "venue": "Sarasota, USA",
            "start_date": "2024-11-20",
            "end_date": "2024-11-24",
            "description": "ICF official SUP World Championships technical race results imported from the official MemoSoft result book.",
            "star_level": "world",
            "score_coefficient": None,
            "source_scope": "ICF官方成绩册导入",
            "result_source_note": "仅录入ICF官方Technical成绩册中的比赛成绩；不录入积分、奖牌榜或汇总榜。",
        },
        "pdf": CACHE_DIR / "2024_icf_sup_wch_technical.pdf",
        "url": "https://www.canoeicf.com/sites/default/files/2024_icf_sup_wch_technical.pdf",
        "file_name": "2024_icf_sup_wch_technical.pdf",
        "parser_note": "Parsed pages 1-66 from the 2024 ICF SUP World Championships technical result book.",
        "format": "2024",
    },
    "2024-long-distance": {
        "event": {
            "name": "2024 ICF SUP World Championships - Long Distance",
            "name_en": "2024 ICF SUP World Championships - Long Distance",
            "slug": "icf-sup-world-championships-long-distance-2024",
            "province": "USA",
            "city": "Sarasota",
            "venue": "Sarasota, USA",
            "start_date": "2024-11-20",
            "end_date": "2024-11-24",
            "description": "ICF official SUP World Championships long distance results imported from the official MemoSoft result book.",
            "star_level": "world",
            "score_coefficient": None,
            "source_scope": "ICF官方成绩册导入",
            "result_source_note": "仅录入ICF官方Long Distance成绩册中的比赛成绩；不录入积分、奖牌榜或汇总榜。",
        },
        "pdf": CACHE_DIR / "2024_icf_sup_wch_results_long_distance.pdf",
        "url": "https://www.canoeicf.com/sites/default/files/2024_icf_sup_wch_results_long_distance.pdf",
        "file_name": "2024_icf_sup_wch_results_long_distance.pdf",
        "parser_note": "Parsed pages 1-22 from the 2024 ICF SUP World Championships long distance result book.",
        "format": "long_distance",
    },
    "2023-sprint": {
        "event": {
            "name": "2023 ICF SUP World Championships - Sprint",
            "name_en": "2023 ICF SUP World Championships - Sprint",
            "slug": "icf-sup-world-championships-sprint-2023",
            "province": "Thailand",
            "city": "Pattaya",
            "venue": "Pattaya, Thailand",
            "start_date": "2023-11-15",
            "end_date": "2023-11-19",
            "description": "ICF official SUP World Championships sprint results imported from the official MemoSoft result book.",
            "star_level": "world",
            "score_coefficient": None,
            "source_scope": "ICF官方成绩册导入",
            "result_source_note": "仅录入ICF官方Sprint成绩册中的比赛成绩；不录入积分、奖牌榜或汇总榜。",
        },
        "pdf": CACHE_DIR / "2023_icf_sup_wch_sprint_results.pdf",
        "url": "https://www.canoeicf.com/sites/default/files/2023_icf_sup_wch_sprint_results.pdf",
        "file_name": "2023_icf_sup_wch_sprint_results.pdf",
        "parser_note": "Parsed pages 1-81 from the 2023 ICF SUP World Championships sprint result book.",
        "format": "2024",
    },
    "2023-technical": {
        "event": {
            "name": "2023 ICF SUP World Championships - Technical",
            "name_en": "2023 ICF SUP World Championships - Technical",
            "slug": "icf-sup-world-championships-technical-2023",
            "province": "Thailand",
            "city": "Pattaya",
            "venue": "Pattaya, Thailand",
            "start_date": "2023-11-15",
            "end_date": "2023-11-19",
            "description": "ICF official SUP World Championships technical race results imported from the official MemoSoft result book.",
            "star_level": "world",
            "score_coefficient": None,
            "source_scope": "ICF官方成绩册导入",
            "result_source_note": "仅录入ICF官方Technical成绩册中的比赛成绩；不录入积分、奖牌榜或汇总榜。",
        },
        "pdf": CACHE_DIR / "2023_icf_sup_wch_results_technical.pdf",
        "url": "https://www.canoeicf.com/sites/default/files/results_technical.pdf",
        "file_name": "2023_icf_sup_wch_results_technical.pdf",
        "parser_note": "Parsed pages 1-83 from the 2023 ICF SUP World Championships technical result book.",
        "format": "2024",
    },
    "2023-long-distance": {
        "event": {
            "name": "2023 ICF SUP World Championships - Long Distance",
            "name_en": "2023 ICF SUP World Championships - Long Distance",
            "slug": "icf-sup-world-championships-long-distance-2023",
            "province": "Thailand",
            "city": "Pattaya",
            "venue": "Pattaya, Thailand",
            "start_date": "2023-11-15",
            "end_date": "2023-11-19",
            "description": "ICF official SUP World Championships long distance results imported from the official MemoSoft result book.",
            "star_level": "world",
            "score_coefficient": None,
            "source_scope": "ICF官方成绩册导入",
            "result_source_note": "仅录入ICF官方Long Distance成绩册中的比赛成绩；不录入积分、奖牌榜或汇总榜。",
        },
        "pdf": CACHE_DIR / "2023_icf_sup_wch_results_long_distance.pdf",
        "url": "https://www.canoeicf.com/sites/default/files/results_long_distance.pdf",
        "file_name": "2023_icf_sup_wch_results_long_distance.pdf",
        "parser_note": "Parsed pages 1-25 from the 2023 ICF SUP World Championships long distance result book.",
        "format": "long_distance",
    },
}


def normalize_text(value: str) -> str:
    return (
        str(value or "")
        .replace("\u00ad", "-")
        .replace("–", "-")
        .replace("—", "-")
        .replace("­", "-")
        .strip()
    )


def lines_for_page(page: fitz.Page) -> list[str]:
    return [normalize_text(line) for line in page.get_text().splitlines() if normalize_text(line)]


def is_title(line: str) -> bool:
    return bool(TITLE_RE.match(line))


def is_long_distance_title(line: str) -> bool:
    return bool(LONG_DISTANCE_TITLE_RE.match(line))


def extract_long_distance_carryover(lines: list[str]) -> tuple[list[str], list[str]]:
    """MemoSoft long-distance PDFs sometimes print the next race winner before its repeated header."""
    for index in range(len(lines) - 1, -1, -1):
        if re.fullmatch(r"\d+\s+Laps?", lines[index]):
            tail = lines[index + 1 :]
            if len(tail) >= 7 and re.fullmatch(r"\d{2}/\d{2}/\d{4}", tail[-3]) and re.fullmatch(r"\d{1,2}:\d{2}", tail[-2]) and tail[-1].startswith("Race "):
                candidate = tail[:-3]
                if candidate and NUMBER_RE.match(candidate[0]) and any(COUNTRY_RE.match(item) for item in candidate):
                    return lines[:index], candidate
            return lines, []
    return lines, []


def roman_to_number(value: str) -> str:
    roman = {
        "I": "1",
        "II": "2",
        "III": "3",
        "IV": "4",
        "V": "5",
        "VI": "6",
        "VII": "7",
        "VIII": "8",
        "IX": "9",
        "X": "10",
    }
    return roman.get(value, value)


def split_title(title: str, year: str) -> tuple[str, str, str, str | None]:
    if " - " in title:
        left, right = [part.strip() for part in title.split(" - ", 1)]
    else:
        left = title.strip()
        right = "Final"
    left = re.sub(r"\s+", " ", left)
    right = re.sub(r"\s+", " ", right)
    board_class = None

    lowered = left.lower()
    if lowered.startswith("inflatable sup"):
        discipline = "Inflatable SUP"
        group = left[len("Inflatable SUP") :].strip()
        board_class = "Inflatable SUP"
    elif lowered.startswith("long distance"):
        discipline = "Long Distance"
        group = left[len("Long distance") :].strip()
    elif lowered.startswith("technical"):
        discipline = "Technical"
        group = left[len("Technical") :].strip()
    elif lowered.startswith("sprint"):
        distance = ""
        if year == "2024":
            match = re.search(r"\b\d+m\b", left, flags=re.IGNORECASE)
            if match:
                distance = f" {match.group(0)}"
                left = (left[: match.start()] + left[match.end() :]).strip()
        discipline = f"Sprint{distance}"
        group = left[len("Sprint") :].strip()
    else:
        discipline = left
        group = "Open"

    group = " ".join(part.capitalize() if part.lower() in {"open", "men", "women", "junior", "juniors", "master", "masters"} else part for part in group.split())
    right = right.replace("PR1", "Preliminary Round 1").replace("PR2", "Preliminary Round 2")
    right = re.sub(r"\bQF\b", "Quarterfinal", right)
    right = re.sub(r"\bSF\b", "Semifinal", right)
    right = re.sub(r"\bFA\b", "Final A", right)
    right = re.sub(r"\bFB\b", "Final B", right)
    right = re.sub(r"\bFC\b", "Final C", right)
    tokens = right.split()
    if tokens and re.fullmatch(r"[IVX]+", tokens[-1]):
        tokens[-1] = roman_to_number(tokens[-1])
        right = " ".join(tokens)
    return discipline.strip(), group.strip() or "Open", right.strip(), board_class


def normalize_nationality(value: str) -> str:
    code = str(value or "").strip().upper()
    return COUNTRY_TO_CHINESE.get(code, code)


def parse_time_to_seconds(value: str) -> float | None:
    raw = str(value or "").strip()
    if not raw or raw.upper() in STATUS_CODES:
        return None
    if not TIME_RE.match(raw):
        return None
    parts = raw.split(":")
    try:
        if len(parts) == 1:
            return float(parts[0])
        if len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    except ValueError:
        return None
    return None


def should_stop(line: str) -> bool:
    lower = line.lower()
    return (
        is_title(line)
        or line.startswith("Race ")
        or line.startswith("Wind speed")
        or line.startswith("Air temp")
        or line.startswith("Water temp")
        or line.startswith("Chief ")
        or line.startswith("Starter:")
        or line.startswith("Course Umpire")
        or line.startswith("DNF Did")
        or line.startswith("DNS Did")
        or line.startswith("DSQ Dis")
        or line.startswith("DQB Dis")
        or line.startswith("FA-F")
        or line.startswith("S|QF")
        or line.startswith("P Pending")
        or line == "RESULTS"
        or line.startswith("Timing and data")
        or line.startswith("© ")
        or lower.startswith("page")
        or bool(re.match(r"^\d{1,2}:\d{2}:\d{2}\s+-\s+\d{2}/\d{2}/\d{4}$", line))
        or bool(re.match(r"^\d+(st|nd|rd|th)-", line))
        or bool(re.match(r"^\d+\s*-\s*\d+\s+to\b", lower))
        or bool(re.match(r"^\d+-\d+\s+to\b", lower))
    )


def table_sections(doc: fitz.Document) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for page_index in range(doc.page_count):
        for line in lines_for_page(doc[page_index]):
            if is_title(line):
                if current:
                    pre_lines: list[str] = []
                    if is_long_distance_title(line) and is_long_distance_title(current["title"]):
                        current["lines"], pre_lines = extract_long_distance_carryover(current["lines"])
                    sections.append(current)
                current = {"title": line, "page": page_index + 1, "lines": [], "pre_lines": pre_lines if "pre_lines" in locals() else []}
                if "pre_lines" in locals():
                    del pre_lines
                continue
            if current:
                current["lines"].append(line)
    if current:
        sections.append(current)
    return sections


def find_after_header(lines: list[str]) -> int:
    last_header_index = -1
    for index, line in enumerate(lines[:30]):
        if line in {"Rank", "Lane", "NF", "Name(s)", "Time"}:
            last_header_index = index
    return last_header_index + 1 if last_header_index >= 0 else 0


def consume_optional_label(lines: list[str], index: int) -> tuple[str | None, int]:
    if index >= len(lines):
        return None, index
    value = lines[index]
    labels = {
        "MD",
        "PR",
        "PR2",
        "FA",
        "FB",
        "FC",
        "FD",
        "FE",
        "FF",
        "SF",
        "QF",
        "Final",
        "Semifinal",
        "Quarterfinal",
    }
    if value in labels or re.fullmatch(r"F[A-F]", value):
        return value, index + 1
    return None, index


def status_note(code: str | None) -> str | None:
    if not code:
        return None
    return STATUS_LABELS.get(code)


def normalize_status(code: str | None) -> str | None:
    if not code:
        return None
    code = code.upper()
    if code == "DQB":
        return "DQ"
    return code if code in STATUS_CODES else None


def make_row(
    *,
    title: str,
    page: int,
    year: str,
    rank: int | None,
    status_index: int,
    lane: str | None,
    bib: str | None,
    nf: str,
    name: str,
    finish_time: str,
    result_label: str | None,
    status_code: str | None,
) -> dict[str, Any]:
    discipline, gender_group, round_label, board_class = split_title(title, year)
    effective_code = normalize_status(status_code or finish_time)
    return {
        "athlete_name_snapshot": name.strip(),
        "bib_number": bib or lane,
        "gender_group": gender_group,
        "discipline": discipline,
        "board_class": board_class,
        "round_label": round_label,
        "rank_position": rank if rank is not None else 9000 + status_index,
        "result_label": result_label,
        "finish_time": finish_time,
        "result_status_code": effective_code,
        "result_status_note": status_note(status_code or finish_time),
        "time_seconds": parse_time_to_seconds(finish_time),
        "points": None,
        "team_name": "个人",
        "team_members": [],
        "nationality_snapshot": normalize_nationality(nf),
        "source_locator": f"page:{page} | {title}",
        "source_note": title,
        "parse_confidence": 0.99,
        "review_status": "confirmed",
        "is_verified": True,
    }


def parse_2025_section(section: dict[str, Any]) -> list[dict[str, Any]]:
    lines = section["lines"]
    index = find_after_header(lines)
    out: list[dict[str, Any]] = []
    status_counter = 0
    while index < len(lines):
        line = lines[index]
        if should_stop(line):
            break
        if line in {"Race"} or line.startswith("Race ") or re.match(r"^\d{1,2}:\d{2}\s+-", line):
            index += 1
            continue
        if not NUMBER_RE.match(line):
            index += 1
            continue

        rank: int | None = None
        lane: str | None = None
        if index + 2 < len(lines) and NUMBER_RE.match(lines[index + 1]) and COUNTRY_RE.match(lines[index + 2]):
            rank = int(lines[index])
            lane = lines[index + 1]
            index += 3
        elif index + 1 < len(lines) and COUNTRY_RE.match(lines[index + 1]):
            lane = lines[index]
            index += 2
        else:
            index += 1
            continue

        nf = lines[index - 1]
        name_parts: list[str] = []
        while index < len(lines) and not TIME_RE.match(lines[index]) and lines[index].upper() not in STATUS_CODES and not should_stop(lines[index]):
            name_parts.append(lines[index])
            index += 1
        if not name_parts or index >= len(lines):
            continue
        finish_time = lines[index].upper() if lines[index].upper() in STATUS_CODES else lines[index]
        status_code = finish_time if finish_time in STATUS_CODES else None
        if status_code:
            status_counter += 1
        index += 1

        labels: list[str] = []
        if index < len(lines) and BEHIND_RE.match(lines[index]):
            labels.append(lines[index])
            index += 1
        label, index = consume_optional_label(lines, index)
        if label:
            labels.append(label)

        out.append(
            make_row(
                title=section["title"],
                page=section["page"],
                year="2025",
                rank=rank,
                status_index=status_counter,
                lane=lane,
                bib=None,
                nf=nf,
                name=" ".join(name_parts),
                finish_time=finish_time,
                result_label=" ".join(labels) if labels else None,
                status_code=status_code,
            )
        )
    return out


def parse_2024_section(section: dict[str, Any]) -> list[dict[str, Any]]:
    lines = section["lines"]
    index = find_after_header(lines)
    out: list[dict[str, Any]] = []
    status_counter = 0
    while index < len(lines):
        line = lines[index]
        if should_stop(line):
            break
        if not (NUMBER_RE.match(line) or line.upper() in STATUS_CODES or line in {"PR2", "SF", "FA", "FB", "FC", "FD", "FE", "FF"}):
            index += 1
            continue

        labels: list[str] = []
        label, next_index = consume_optional_label(lines, index)
        if label:
            labels.append(label)
            index = next_index
        if index >= len(lines):
            break

        rank: int | None = None
        finish_time = ""
        status_code: str | None = None
        if lines[index].upper() in STATUS_CODES:
            status_code = lines[index].upper()
            finish_time = status_code
            status_counter += 1
            index += 1
        elif NUMBER_RE.match(lines[index]) and index + 1 < len(lines) and TIME_RE.match(lines[index + 1]):
            rank = int(lines[index])
            finish_time = lines[index + 1]
            index += 2
            if index < len(lines) and BEHIND_RE.match(lines[index]):
                labels.append(lines[index])
                index += 1
        else:
            index += 1
            continue

        if index < len(lines) and YEAR_RE.match(lines[index]):
            index += 1
        if index >= len(lines) or not COUNTRY_RE.match(lines[index]):
            continue
        nf = lines[index]
        index += 1
        if index >= len(lines):
            continue
        lane = lines[index] if NUMBER_RE.match(lines[index]) else None
        if lane:
            index += 1
        if index >= len(lines):
            continue
        bib = lines[index] if NUMBER_RE.match(lines[index]) else None
        if bib:
            index += 1

        name_parts: list[str] = []
        while index < len(lines):
            nxt = lines[index]
            if should_stop(nxt) or nxt in {"PR2", "SF", "FA", "FB", "FC", "FD", "FE", "FF"} or NUMBER_RE.match(nxt) or nxt.upper() in STATUS_CODES:
                break
            name_parts.append(nxt)
            index += 1
        if not name_parts:
            continue

        out.append(
            make_row(
                title=section["title"],
                page=section["page"],
                year="2024",
                rank=rank,
                status_index=status_counter,
                lane=lane,
                bib=bib,
                nf=nf,
                name=" ".join(name_parts),
                finish_time=finish_time,
                result_label=" ".join(labels) if labels else None,
                status_code=status_code,
            )
        )
    return out


def parse_long_distance_section(section: dict[str, Any]) -> list[dict[str, Any]]:
    lines = list(section.get("pre_lines") or []) + section["lines"][find_after_header(section["lines"]) :]
    index = 0
    out: list[dict[str, Any]] = []
    status_counter = 0

    while index < len(lines):
        line = lines[index]
        if should_stop(line):
            break
        if not NUMBER_RE.match(line):
            index += 1
            continue

        # Long-distance books use a running row number first, then the official rank.
        index += 1
        name_parts: list[str] = []
        while index < len(lines) and not NUMBER_RE.match(lines[index]) and not should_stop(lines[index]):
            name_parts.append(lines[index])
            index += 1
        if not name_parts or index >= len(lines) or not NUMBER_RE.match(lines[index]):
            continue

        rank_value = int(lines[index])
        index += 1
        if index >= len(lines) or not COUNTRY_RE.match(lines[index]):
            continue
        nf = lines[index]
        index += 1
        if index >= len(lines):
            continue

        finish_time = lines[index].upper() if lines[index].upper() in STATUS_CODES else lines[index]
        status_code = finish_time if finish_time in STATUS_CODES else None
        if status_code:
            status_counter += 1
        index += 1

        labels: list[str] = []
        if index < len(lines) and (TIME_RE.match(lines[index]) or re.match(r"^\d{2}:\d{2}\.\d{1,3}$", lines[index])):
            labels.append(lines[index])
            index += 1

        bib = None
        if index < len(lines) and NUMBER_RE.match(lines[index]):
            bib = lines[index]
            index += 1

        out.append(
            make_row(
                title=section["title"],
                page=section["page"],
                year="long_distance",
                rank=None if status_code else rank_value,
                status_index=status_counter,
                lane=None,
                bib=bib,
                nf=nf,
                name=" ".join(name_parts),
                finish_time=finish_time,
                result_label=" ".join(labels) if labels else None,
                status_code=status_code,
            )
        )
    return out


def parse_event(key: str) -> dict[str, Any]:
    config = EVENTS[key]
    pdf_path = Path(config["pdf"])
    if not pdf_path.exists():
        raise FileNotFoundError(f"missing PDF: {pdf_path}")
    doc = fitz.open(pdf_path)
    results: list[dict[str, Any]] = []
    if config["format"] == "2025":
        parser = parse_2025_section
    elif config["format"] == "long_distance":
        parser = parse_long_distance_section
    else:
        parser = parse_2024_section
    for section in table_sections(doc):
        results.extend(parser(section))

    payload = {
        "event": config["event"],
        "source": {
            "original_path": str(pdf_path.resolve()),
            "file_name": config["file_name"],
            "file_type": "pdf",
            "source_url": config["url"],
            "parser_name": "local-race-results-import",
            "parser_status": "parsed",
            "parser_note": config["parser_note"],
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "official_icf_result_book",
                "official_source_url": config["url"],
                "page_count": doc.page_count,
                "points_imported": False,
            },
        },
        "results": results,
    }
    return payload


def validate_payload(payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    rows = payload["results"]
    if not rows:
        errors.append("no rows parsed")
    missing = [index for index, row in enumerate(rows, 1) if not row.get("athlete_name_snapshot") or not row.get("discipline") or not row.get("gender_group") or not row.get("finish_time")]
    if missing:
        errors.append(f"missing required fields rows={missing[:10]}")
    if any(row.get("points") is not None for row in rows):
        errors.append("points must be null for all rows")
    module_rank_ones = collections.Counter(
        (
            row.get("discipline"),
            row.get("gender_group"),
            row.get("board_class") or "",
            row.get("round_label") or "",
        )
        for row in rows
        if row.get("rank_position") == 1 and not row.get("result_status_code")
    )
    duplicates = [key for key, count in module_rank_ones.items() if count > 1]
    if duplicates:
        errors.append(f"multiple effective rank-1 modules={duplicates[:10]}")
    return errors


def write_payload(payload: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", choices=["2023", "2024", "2025", "all"], default="all")
    parser.add_argument("--key", choices=sorted(EVENTS), default="")
    parser.add_argument("--keys", default="", help="Comma-separated source keys, for example 2024-technical,2024-long-distance.")
    parser.add_argument("--new-only", action="store_true", help="Skip verify-only sources such as already imported 2024 sprint.")
    parser.add_argument("--combined-output", default="", help="Optional JSON output path for all selected payloads.")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()

    if args.keys:
        keys = [key.strip() for key in args.keys.split(",") if key.strip()]
        unknown = [key for key in keys if key not in EVENTS]
        if unknown:
            raise SystemExit(f"unknown keys: {', '.join(unknown)}")
    elif args.key:
        keys = [args.key]
    elif args.year == "all":
        keys = ["2025", "2024", "2024-technical", "2024-long-distance", "2023-sprint", "2023-technical", "2023-long-distance"]
    elif args.year == "2024":
        keys = ["2024", "2024-technical", "2024-long-distance"]
    elif args.year == "2023":
        keys = ["2023-sprint", "2023-technical", "2023-long-distance"]
    else:
        keys = ["2025"]
    if args.new_only:
        keys = [key for key in keys if not EVENTS[key].get("verify_only")]

    payloads: list[dict[str, Any]] = []
    for key in keys:
        payload = parse_event(key)
        errors = validate_payload(payload)
        status_counts = collections.Counter(row.get("result_status_code") or "OK" for row in payload["results"])
        modules = collections.Counter((row["discipline"], row["gender_group"], row.get("board_class") or "", row.get("round_label") or "") for row in payload["results"])
        print(f"{key}: rows={len(payload['results'])} modules={len(modules)} status={dict(status_counts)}")
        if errors:
            for error in errors:
                print(f"ERROR {key}: {error}")
            raise SystemExit(1)
        payloads.append(payload)
        if not args.validate_only:
            out = CACHE_DIR / f"icf-sup-worlds-{key}-results.json"
            write_payload(payload, out)
            print(f"wrote {out}")
    if args.combined_output and not args.validate_only:
        out = Path(args.combined_output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payloads, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"wrote combined {out}")


if __name__ == "__main__":
    main()
