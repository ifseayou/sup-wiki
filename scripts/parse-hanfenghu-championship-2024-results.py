#!/usr/bin/env python3
import argparse
import json
import re
import shutil
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_NAME = "2024汉丰湖全国桨板锦标赛"
EVENT_SLUG = "hanfenghu-national-sup-championship-2024"
PDF_PATH = Path("/Users/xhl/Desktop/桨板比赛成绩/2024/2024汉丰湖全国桨板锦标赛/2024汉丰湖全国桨板锦标赛成绩册.pdf")
PUBLIC_DIR = "hanfenghu-national-sup-championship-2024"
FILE_NAME = "results-book.pdf"
DISPLAY_FILE_NAME = "2024汉丰湖全国桨板锦标赛成绩册.pdf"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
}
STATUS_CODES = set(STATUS_LABELS)


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalize_group(value: str) -> str:
    text = clean(value)
    replacements = {
        "公开组男子": "公开男子组",
        "公开组女子": "公开女子组",
        "大众组男子": "大众男子组",
        "大众组女子": "大众女子组",
        "充气板组男子": "充气板男子组",
        "充气板组女子": "充气板女子组",
        "大师组男子": "大师男子组",
        "大师组女子": "大师女子组",
        "卡胡纳组男子": "卡胡纳男子组",
        "卡胡纳组女子": "卡胡纳女子组",
        "高校甲组男子": "高校甲男子组",
        "高校甲组女子": "高校甲女子组",
        "高校乙组男子": "高校乙男子组",
        "高校乙组女子": "高校乙女子组",
    }
    if text in replacements:
        return replacements[text]
    match = re.fullmatch(r"U(\d+)组(男子|女子)", text)
    if match:
        return f"U{match.group(1)}{match.group(2)}组"
    return text


def status_code(value: str) -> str | None:
    code = clean(value).upper()
    return code if code in STATUS_CODES else None


def normalize_time(value: str) -> str:
    return clean(value).upper().replace("：", ":")


def time_seconds(value: str) -> float | None:
    text = normalize_time(value)
    if status_code(text):
        return None
    if not re.fullmatch(r"\d{1,2}:\d{2}:\d{2}(?:\.\d+)?", text):
        return None
    hours, minutes, seconds = text.split(":")
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def has_result_tail(line: str) -> bool:
    return bool(re.search(r"(?:\d{1,2}:\d{2}:\d{2}(?:\.\d+)?|DNS|DNF|DQ|DSQ)(?:\s+(?:DNS|DNF|DQ|DSQ))?$", clean(line), re.I))


def normalize_lines(text: str) -> list[str]:
    out: list[str] = []
    for raw in text.splitlines():
        line = clean(raw)
        if not line:
            continue
        if line.startswith(("长距离赛成绩单", "名次 ", "气温：", "检录长：", "公示时间：")):
            continue
        if line.startswith("NO."):
            out.append(line)
            continue
        if out and not has_result_tail(out[-1]) and not re.match(r"^(NO\.|\d{1,3}\s+)?\d{3,4}\s+", line):
            out[-1] = clean(f"{out[-1]}{line}")
            continue
        out.append(line)
    return out


def context_from_title(line: str) -> dict[str, Any] | None:
    match = re.search(r"NO\.\d+\s+(.+?)长距离赛\s+地点：(.+?)\s+时间：(\d{4})/(\d{1,2})/(\d{1,2})", line)
    if not match:
        return None
    group, place, year, month, day = match.groups()
    group_name = normalize_group(group)
    board_class = None
    if "充气板" in group_name:
        board_class = "充气板"
    elif "卡胡纳" in group_name:
        board_class = "卡胡纳"
    return {
        "gender_group": group_name,
        "discipline": "长距离赛",
        "board_class": board_class,
        "round_label": "决赛",
        "source_note": clean(f"{group}长距离赛"),
        "date": f"{int(year):04d}-{int(month):02d}-{int(day):02d}",
        "place": clean(place),
    }


def split_name_team_result(rest: str) -> tuple[str, str, str, str | None, str | None] | None:
    tokens = clean(rest).split()
    if (
        len(tokens) >= 4
        and status_code(tokens[-1])
        and re.fullmatch(r"\d{1,2}:\d{2}:\d{2}(?:\.\d+)?", normalize_time(tokens[-2]))
    ):
        prefix = tokens[:-2]
        if len(prefix) >= 2:
            return prefix[0], clean(" ".join(prefix[1:])), normalize_time(tokens[-2]), status_code(tokens[-1]), status_code(tokens[-1])
    for index in range(len(tokens) - 1, 0, -1):
        candidate = normalize_time(tokens[index])
        if not re.fullmatch(r"\d{1,2}:\d{2}:\d{2}(?:\.\d+)?|DNS|DNF|DQ|DSQ", candidate):
            continue
        trailing = [normalize_time(item) for item in tokens[index + 1 :]]
        result_code = status_code(candidate)
        note = clean(" ".join(trailing)) or None
        if trailing and status_code(trailing[0]):
            result_code = trailing[0]
        prefix = tokens[:index]
        if len(prefix) < 2:
            continue
        return prefix[0], clean(" ".join(prefix[1:])), candidate, note, result_code
    return None


def make_result(
    context: dict[str, Any],
    *,
    page_number: int,
    rank_position: int,
    bib_number: str,
    athlete_name: str,
    team_name: str,
    finish_time: str,
    result_label: str | None,
    result_status_code: str | None,
) -> dict[str, Any]:
    finish = normalize_time(finish_time)
    code = result_status_code or status_code(finish)
    return {
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
        "result_status_note": STATUS_LABELS.get(code or ""),
        "time_seconds": time_seconds(finish),
        "points": None,
        "team_name": clean(team_name) or "个人",
        "team_members": [],
        "nationality_snapshot": "中国",
        "source_locator": f"page:{page_number}",
        "source_note": context["source_note"],
        "parse_confidence": 0.99,
        "review_status": "confirmed",
        "is_verified": True,
    }


def parse_row(line: str, context: dict[str, Any], page_number: int, status_index: int) -> tuple[dict[str, Any] | None, int]:
    ranked = re.match(r"^(\d{1,3})\s+(\d{3,4})\s+(.+)$", line)
    if ranked:
        rank_raw, bib_number, rest = ranked.groups()
        split = split_name_team_result(rest)
        if not split:
            return None, status_index
        name, team, finish, note, code = split
        rank = int(rank_raw)
        if code:
            status_index += 1
            rank = 9000 + status_index
        return make_result(
            context,
            page_number=page_number,
            rank_position=rank,
            bib_number=bib_number,
            athlete_name=name,
            team_name=team,
            finish_time=finish,
            result_label=note,
            result_status_code=code,
        ), status_index

    status = re.match(r"^(\d{3,4})\s+(.+)$", line)
    if not status:
        return None, status_index
    bib_number, rest = status.groups()
    split = split_name_team_result(rest)
    if not split:
        return None, status_index
    name, team, finish, note, code = split
    status_index += 1
    return make_result(
        context,
        page_number=page_number,
        rank_position=9000 + status_index,
        bib_number=bib_number,
        athlete_name=name,
        team_name=team,
        finish_time=finish,
        result_label=note,
        result_status_code=code,
    ), status_index


def parse_pdf(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    results: list[dict[str, Any]] = []
    contexts: dict[str, dict[str, Any]] = {}
    status_index_by_group: dict[str, int] = {}
    current: dict[str, Any] | None = None

    for page_number, page in enumerate(reader.pages, start=1):
        for line in normalize_lines(page.extract_text() or ""):
            next_context = context_from_title(line)
            if next_context:
                current = next_context
                key = current["gender_group"]
                contexts[key] = current
                status_index_by_group.setdefault(key, 0)
                continue
            if not current:
                continue
            parsed, status_index_by_group[current["gender_group"]] = parse_row(
                line,
                current,
                page_number,
                status_index_by_group[current["gender_group"]],
            )
            if parsed:
                results.append(parsed)
            elif re.match(r"^(\d{1,3}\s+)?\d{3,4}\s+", line) and has_result_tail(line):
                raise ValueError(f"Unparsed result row on page {page_number}: {line}")

    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "start_date": "2024-11-02",
            "end_date": "2024-11-02",
            "province": "重庆市",
            "city": "重庆市",
            "venue": "开州汉丰湖",
            "event_status": "completed",
            "result_status": "extended_complete",
            "source_scope": "本地成绩册导入",
            "result_source_note": "录入2024汉丰湖全国桨板锦标赛成绩册长距离赛全部成绩，含DNS/DNF/DSQ等状态行。",
        },
        "source": {
            "original_path": str(path),
            "file_name": DISPLAY_FILE_NAME,
            "file_type": "pdf",
            "source_url": f"/result-books/{PUBLIC_DIR}/{FILE_NAME}",
            "parser_name": "parse-hanfenghu-championship-2024-results.py",
            "parser_status": "parsed",
            "parser_note": "抽取PDF第1-59页长距离赛成绩单，按组别跨页连续解析。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "local_result_book",
                "relative_path": f"{PUBLIC_DIR}/{FILE_NAME}",
                "event_key": EVENT_SLUG,
                "page_range": "1-59",
                "modules": sorted(contexts.keys()),
            },
        },
        "results": results,
    }


def copy_pdf_to_public(source: Path) -> None:
    target = Path("public") / "result-books" / PUBLIC_DIR / FILE_NAME
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or target.stat().st_size != source.stat().st_size:
        shutil.copy2(source, target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("-o", "--output", type=Path, default=Path(".cache/hanfenghu-championship-2024-results.json"))
    parser.add_argument("--copy-to-public", action="store_true")
    args = parser.parse_args()
    payload = parse_pdf(PDF_PATH)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.copy_to_public:
        copy_pdf_to_public(PDF_PATH)
    modules = {}
    statuses = {}
    for row in payload["results"]:
        modules[f"{row['discipline']} · {row['gender_group']}"] = modules.get(f"{row['discipline']} · {row['gender_group']}", 0) + 1
        statuses[row["result_status_code"] or "OK"] = statuses.get(row["result_status_code"] or "OK", 0) + 1
    print(f"results={len(payload['results'])} modules={len(modules)} statuses={statuses} output={args.output}")


if __name__ == "__main__":
    main()
