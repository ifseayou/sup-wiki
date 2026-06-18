#!/usr/bin/env python3
"""Parse 2026 China SUP Open Hanzhong result book into sup-wiki import JSON."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from decimal import Decimal, InvalidOperation
from pathlib import Path

import pdfplumber


EVENT = {
    "event_id": 380,
    "name": "2026年中国桨板国际公开赛（汉中站）",
    "slug": "auto-evt-1781264002852-3gopa5",
    "start_date": "2026-06-13",
    "end_date": "2026-06-14",
    "province": "陕西省",
    "city": "汉中市",
    "venue": "汉江汉中城区段",
    "star_level": "五星",
    "score_coefficient": 5.0,
    "source_scope": "国内外",
    "result_status": "extended_complete",
    "result_source_note": "用户提交成绩册导入：第2-27页积分榜，第28-83页成绩单。",
}

SOURCE_URL = "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/result-submissions/1/1781786112373-l76pr1-%E6%88%90%E7%BB%A9%E5%86%8C.pdf"
SUBMISSION_ID = 32
SUBMISSION_BATCH_ID = "mp_1781786111424_mittlaou"
OUTPUT = Path(".cache/china-sup-open-hanzhong-2026-results.json")

STATUS_CODES = {"DNS", "DNF", "DQ", "DSQ", "DSQ-R", "DNQ", "OTL"}
TIME_RE = re.compile(r"\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?")
TEAM_RACE_PREFIXES = ("双人", "家庭", "四人")


def clean(text: object) -> str:
    return re.sub(r"\s+", " ", str(text or "").replace("\u3000", " ")).strip()


def normalize_group(text: str) -> str:
    value = clean(text)
    value = value.replace("个人赛成绩积分", "")
    value = value.replace("成绩积分", "")
    value = value.replace("个人赛", "")
    value = value.replace("（", "(").replace("）", ")")
    value = re.sub(r"\([^)]*\)", "", value)
    value = value.replace("赛", "", 1) if value.startswith(("大众赛", "精英赛", "城市赛")) else value
    value = value.replace("组", "")
    value = value.replace("男子", "男子组").replace("女子", "女子组")
    value = value.replace("公开男子组", "公开男子组").replace("公开女子组", "公开女子组")
    return clean(value) or "公开组"


def normalize_status(code: str | None) -> str | None:
    value = clean(code).upper()
    if value == "DSQ-R":
        return "DSQ"
    return value if value in STATUS_CODES else None


def decimal_or_none(value: object):
    text = clean(value)
    if not text or text in {"-", "DNS", "DNF", "DSQ", "DSQ-R", "DQ"}:
        return None
    try:
        return float(Decimal(text))
    except InvalidOperation:
        return None


def int_or_none(value: object):
    text = clean(value)
    return int(text) if text.isdigit() else None


def status_rank(value: object) -> str | None:
    text = clean(value)
    if not text or text.isdigit():
        return None
    return text


def collect_known_teams(pdf) -> list[str]:
    teams: set[str] = set(["个人", "杨凌"])
    for page_index in range(1, min(27, len(pdf.pages))):
        for table in pdf.pages[page_index].extract_tables() or []:
            if not table:
                continue
            header = [clean(item) for item in table[0]]
            for row in table[1:]:
                mapped = {header[i]: clean(row[i]) for i in range(min(len(header), len(row)))}
                for key in ("代表单位", "参赛高校"):
                    if mapped.get(key):
                        teams.add(mapped[key])
    return sorted(teams, key=len, reverse=True)


def parse_point_tables(pdf) -> list[dict]:
    standings: list[dict] = []
    last_group = ""
    for page_no in range(2, 28):
        page = pdf.pages[page_no - 1]
        lines = [clean(line) for line in (page.extract_text() or "").splitlines() if clean(line)]
        title = next((line for line in lines if line not in {"2026年中国桨板国际公开赛(汉中站)"} and "名次" not in line), "")
        if not re.search(r"积分|参赛单位|高校|双人|龙板|大众|精英|城市", title):
            title = last_group
        for table in page.extract_tables() or []:
            if not table:
                continue
            header = [clean(item) for item in table[0]]
            if header and header[0].isdigit():
                # pdfplumber occasionally treats the last data row from previous page as header.
                header = ["名次", "参赛号码", "姓名", "代表单位", "耐力赛排名", "耐力赛积分", "冲刺赛排名", "冲刺赛积分", "总积分"]
                rows = table
            else:
                rows = table[1:]
            for row in rows:
                mapped = {header[i]: clean(row[i]) for i in range(min(len(header), len(row)))}
                if not any(mapped.values()):
                    continue
                rank = mapped.get("名次")
                group_name = mapped.get("组别") or title
                if "参赛单位积分" in lines[:2] or "代表单位" in header and "姓名" not in header:
                    group_name = "参赛单位积分"
                    name = mapped.get("代表单位")
                    team = name
                elif "高校积分" in lines[:2] or "参赛高校" in header:
                    group_name = "高校积分"
                    name = mapped.get("参赛高校")
                    team = name
                else:
                    name = mapped.get("姓名")
                    team = mapped.get("代表单位")
                    group_name = normalize_group(group_name)
                if not name:
                    continue
                if group_name:
                    last_group = group_name
                standings.append({
                    "group_name": group_name,
                    "rank_position": int_or_none(rank),
                    "status_rank": status_rank(rank),
                    "bib_number": mapped.get("参赛号码") or None,
                    "athlete_name_snapshot": name,
                    "team_name": team or "个人",
                    "endurance_rank": mapped.get("耐力赛排名") or None,
                    "endurance_points": decimal_or_none(mapped.get("耐力赛积分")),
                    "sprint_rank": mapped.get("冲刺赛排名") or None,
                    "sprint_points": decimal_or_none(mapped.get("冲刺赛积分")),
                    "technical_rank": mapped.get("技术赛排名") or None,
                    "technical_points": decimal_or_none(mapped.get("技术赛积分")),
                    "total_points": decimal_or_none(mapped.get("总积分")),
                    "source_locator": f"page:{page_no}",
                })
    return standings


def result_title(lines: list[str]) -> tuple[str, str, str]:
    idx = next((i for i, line in enumerate(lines) if "成绩单" in line), -1)
    title = lines[idx] if idx >= 0 and lines[idx].replace("成绩单", "").strip() else (lines[idx - 1] if idx > 0 else "")
    title = title.replace("中国桨板国际公开赛（汉中站）", "").strip()
    title = title.replace("成绩单", "").strip()
    if title in {"耐力赛", "冲刺赛", "技术赛"} and idx > 0:
        title = lines[idx - 1].strip()
    title = title.replace("(", "（").replace(")", "）")
    discipline = "耐力赛"
    if "冲刺赛" in title:
        discipline = "冲刺赛"
    elif "技术赛" in title:
        discipline = "技术赛"
    round_line = next((line for line in lines if "发令:" in line or "发令：" in line), "")
    round_label = "预决赛" if "预决赛" in round_line else ("一次性决赛" if "一次性决赛" in round_line else "决赛")
    if title.startswith(TEAM_RACE_PREFIXES):
        team_discipline = re.sub(r"（.*?）", "", title).strip()
        return team_discipline, "混合组", discipline

    group = re.sub(r"（.*?）", "", title)
    group = group.replace(" ", "")
    group = group.replace("赛", "", 1) if group.startswith(("大众赛", "精英赛", "城市赛")) else group
    group = group.replace("男子", "男子组").replace("女子", "女子组")
    group = group.replace("组组", "组")
    group = group.replace("组男子组", "男子组").replace("组女子组", "女子组")
    return discipline, group, round_label


def is_fragment(line: str) -> bool:
    if not line:
        return False
    if any(token in line for token in ("成绩单", "名次", "检录", "裁判长", "晋级规则", "中国桨板")):
        return False
    return not re.search(r"(^\d+\s|^(DNS|DNF|DSQ|DSQ-R|DQ)\s|^预赛\s)", line)


def split_name_team(body: str, teams: list[str], prefix: str = "", suffix: str = "") -> tuple[str, str]:
    raw = clean(f"{prefix}{body}{suffix}")
    for team in teams:
        if team and raw.endswith(team) and len(raw) > len(team):
            return raw[:-len(team)].strip(), team
    latin = re.match(r"^([A-Z]+(?:\s+[A-Z]+)+)\s+(.+)$", raw)
    if latin:
        return latin.group(1), latin.group(2)
    parts = raw.split(" ")
    if len(parts) >= 2:
        return parts[0], " ".join(parts[1:])
    if "、" in raw:
        return raw, "个人"
    return raw, "个人"


def build_result(page_no: int, discipline: str, group: str, round_label: str, rank, start_position, bib, body, finish, note, teams, prefix="", suffix="") -> dict:
    name, team = split_name_team(body, teams, prefix, suffix)
    status_code = normalize_status(finish)
    rank_position = int(rank) if str(rank).isdigit() else None
    if status_code and rank_position is None:
        rank_position = 9000 + {"DNF": 0, "DSQ": 100, "DQ": 100, "DNS": 200}.get(status_code, 300) + (page_no % 100)
    result_label = "预赛" if clean(start_position) == "预赛" else None
    actual_round = "预赛" if clean(start_position) == "预赛" else round_label
    members = [item.strip() for item in re.split(r"[、,，/]+", name) if item.strip()] if "、" in name else []
    return {
        "athlete_name_snapshot": name,
        "bib_number": clean(bib) or None,
        "gender_group": group,
        "discipline": discipline,
        "board_class": None,
        "round_label": actual_round,
        "rank_position": rank_position or 9999,
        "result_label": result_label,
        "finish_time": clean(finish),
        "result_status_code": status_code,
        "result_status_note": ("取消成绩：划行姿态犯规" if clean(finish).upper() == "DSQ-R" or "划行姿态犯规" in clean(note) else None),
        "time_seconds": None,
        "points": None,
        "team_name": team or "个人",
        "team_members": members,
        "nationality_snapshot": "中国",
        "source_locator": f"page:{page_no}",
        "source_note": f"{group} {discipline}",
        "parse_confidence": 0.97,
        "review_status": "confirmed",
        "is_verified": True,
    }


def parse_result_line(line: str, page_no: int, discipline: str, group: str, round_label: str, teams: list[str], prefix="", suffix="") -> dict | None:
    text = clean(line)
    time = TIME_RE.search(text)
    status_matches = list(re.finditer(r"(?<!\w)(DNS|DNF|DSQ-R|DSQ|DQ)(?!\w)", text, re.I))
    status_tail = status_matches[-1] if status_matches else None
    finish = time.group(0) if time else (status_tail.group(1).upper() if status_tail else None)
    if not finish:
        return None
    body_end = time.start() if time else status_tail.start()
    head = text[:body_end].strip()
    note = text[time.end():].strip() if time else (text[status_tail.end():].strip() if status_tail else "")

    m = re.match(r"^(?P<rank>\d+)\s+(?P<start>\d+|预赛)\s+(?P<bib>[A-Z]?\d+|[DTQ]\d+)\s+(?P<body>.+)$", head)
    if m:
        return build_result(page_no, discipline, group, round_label, m.group("rank"), m.group("start"), m.group("bib"), m.group("body"), finish, note, teams, prefix, suffix)

    if normalize_status(finish) and discipline != "耐力赛":
        m = re.match(r"^(?P<start>\d+)\s+(?P<bib>[A-Z]?\d+|[DTQ]\d+)\s+(?P<body>.+)$", head)
        if m:
            return build_result(page_no, discipline, group, round_label, None, m.group("start"), m.group("bib"), m.group("body"), finish, note, teams, prefix, suffix)

    m = re.match(r"^(?P<rank>\d+)\s+(?P<bib>[A-Z]?\d+|[DTQ]\d+)\s+(?P<body>.+)$", head)
    if m:
        return build_result(page_no, discipline, group, round_label, m.group("rank"), None, m.group("bib"), m.group("body"), finish, note, teams, prefix, suffix)

    m = re.match(r"^(?P<start>预赛)\s+(?P<bib>[A-Z]?\d+|[DTQ]\d+)\s+(?P<body>.+)$", head)
    if m:
        return build_result(page_no, discipline, group, round_label, None, m.group("start"), m.group("bib"), m.group("body"), finish, note, teams, prefix, suffix)

    m = re.match(r"^(?P<status>DNS|DNF|DSQ-R|DSQ|DQ)\s+(?:(?P<start>\d+|预赛)\s+)?(?P<bib>[A-Z]?\d+|[DTQ]\d+)\s+(?P<body>.+)$", head, re.I)
    if m:
        return build_result(page_no, discipline, group, round_label, None, m.group("start"), m.group("bib"), m.group("body"), m.group("status").upper(), note, teams, prefix, suffix)

    if discipline != "耐力赛":
        m = re.match(r"^(?P<start>\d+)\s+(?P<bib>[A-Z]?\d+|[DTQ]\d+)\s+(?P<body>.+)$", head)
        if m:
            return build_result(page_no, discipline, group, round_label, None, m.group("start"), m.group("bib"), m.group("body"), finish, note, teams, prefix, suffix)
    return None


def parse_results(pdf, teams: list[str]) -> list[dict]:
    rows: list[dict] = []
    for page_no in range(28, len(pdf.pages) + 1):
        lines = [clean(line) for line in (pdf.pages[page_no - 1].extract_text() or "").splitlines() if clean(line)]
        discipline, group, round_label = result_title(lines)
        pending_prefix = ""
        skip_next = False
        for index, line in enumerate(lines):
            if skip_next:
                skip_next = False
                continue
            if is_fragment(line):
                pending_prefix = line
                continue
            suffix = ""
            if index + 1 < len(lines) and is_fragment(lines[index + 1]):
                suffix = lines[index + 1]
                skip_next = True
            result = parse_result_line(line, page_no, discipline, group, round_label, teams, pending_prefix, suffix)
            pending_prefix = ""
            if result and result["athlete_name_snapshot"]:
                rows.append(result)
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default=str(OUTPUT))
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    with pdfplumber.open(str(input_path)) as pdf:
        teams = collect_known_teams(pdf)
        points = parse_point_tables(pdf)
        results = parse_results(pdf, teams)

    payload = {
        "event": EVENT,
        "source": {
            "original_path": str(input_path),
            "file_name": "成绩册.pdf",
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "result_submission_id": SUBMISSION_ID,
            "result_submission_batch_id": SUBMISSION_BATCH_ID,
            "parser_name": "parse-hanzhong-open-2026-results.py",
            "parser_status": "parsed",
            "parser_note": "2026中国桨板国际公开赛（汉中站）：第2-27页积分，第28-83页成绩。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "user_submitted_result_book",
                "point_pages": "2-27",
                "result_pages": "28-83",
                "point_rows": len(points),
                "result_rows": len(results),
                "status_counts": dict(Counter(row.get("result_status_code") or "OK" for row in results)),
            },
        },
        "results": results,
        "point_standings": points,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output} results={len(results)} point_standings={len(points)}")
    print("status", dict(Counter(row.get("result_status_code") or "OK" for row in results)))
    print("modules", len(Counter((row["discipline"], row["gender_group"], row.get("round_label")) for row in results)))


if __name__ == "__main__":
    main()
