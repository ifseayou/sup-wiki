#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_NAME = "2026“楚天桨王”系列赛暨湖北省桨板公开赛（兴山站）"
EVENT_SLUG = "chutian-paddle-king-xingshan-2026"
SOURCE_URL = "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/result-submissions/1/1780069067582-f7czn7-tmp_92b2e21989d5de70a1a1b8a4b0340032.pdf"
PDF_PATH = Path("/tmp/submission-20-tmp_92b2e21989d5de70a1a1b8a4b0340032.pdf")
FILE_NAME = "2026楚天桨王湖北省桨板公开赛兴山站成绩册.pdf"

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DQ": "取消成绩",
    "DSQ": "取消成绩",
}
STATUS_CODES = set(STATUS_LABELS)


def clean(value: Any) -> str:
    text = str(value or "").replace("：", ":").strip()
    return re.sub(r"\s+", " ", text)


def normalize_group(raw: str) -> str:
    text = clean(raw).replace(" ", "").replace("-", "")
    replacements = {
        "公开组男子": "公开男子组",
        "公开男子": "公开男子组",
        "公开组女子": "公开女子组",
        "公开女子": "公开女子组",
        "40+组男子": "40+男子组",
        "40+男子": "40+男子组",
        "40+组女子": "40+女子组",
        "40+女子": "40+女子组",
        "50+组男子": "50+男子组",
        "50+男子": "50+男子组",
        "50+组女子": "50+女子组",
        "50+女子": "50+女子组",
        "12岁组男子": "U12男子组",
        "12岁男子": "U12男子组",
        "U12组男子": "U12男子组",
        "U12男子": "U12男子组",
        "12岁组女子": "U12女子组",
        "12岁女子": "U12女子组",
        "U12组女子": "U12女子组",
        "U12女子": "U12女子组",
        "15岁组男子": "U15男子组",
        "15岁男子": "U15男子组",
        "U15组男子": "U15男子组",
        "U15男子": "U15男子组",
        "15岁组女子": "U15女子组",
        "15岁女子": "U15女子组",
        "U15组女子": "U15女子组",
        "U15女子": "U15女子组",
    }
    return replacements.get(text, text)


def normalize_time(value: str) -> str:
    return clean(value).upper()


def status_code(value: str | None) -> str | None:
    code = normalize_time(value or "")
    return code if code in STATUS_CODES else None


def time_seconds(value: str) -> float | None:
    text = normalize_time(value)
    if status_code(text):
        return None
    match = re.fullmatch(r"(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?", text)
    if not match:
        return None
    first, second, third, frac = match.groups()
    if third is None:
        seconds = int(first) * 60 + int(second)
    else:
        seconds = int(first) * 3600 + int(second) * 60 + int(third)
    if frac:
        seconds += float(f"0.{frac}")
    return seconds


def is_result_or_status(value: str) -> bool:
    text = normalize_time(value)
    return bool(status_code(text) or re.fullmatch(r"\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?", text))


def context_from_line(line: str) -> dict[str, Any] | None:
    text = clean(line)
    match = re.search(r"组别项目[:：]\s*(.+?)\s*地点[:：]\s*(.+)$", text)
    if not match:
        return None
    group_project, place = match.groups()
    if "长距离" in group_project:
        discipline = "长距离赛"
        group_raw = re.sub(r"-?长距离.*$", "", group_project)
    elif "200米" in group_project:
        discipline = "200米"
        group_raw = re.sub(r"200米.*$", "", group_project)
    else:
        return None
    group = normalize_group(group_raw)
    return {
        "gender_group": group,
        "discipline": discipline,
        "board_class": None,
        "round_label": "决赛",
        "source_note": f"{group} {discipline}",
        "venue_text": clean(place),
    }


def split_name_team(prefix: str) -> tuple[str, str]:
    tokens = clean(prefix).split()
    if not tokens:
        return "", "个人"
    if len(tokens) >= 2 and len(tokens[0]) == 1 and len(tokens[1]) == 1:
        name = f"{tokens[0]}{tokens[1]}"
        team_tokens = tokens[2:]
    else:
        name = tokens[0]
        team_tokens = tokens[1:]
    team = clean(" ".join(team_tokens)) or "个人"
    return name, team


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
    result_status_code: str | None = None,
) -> dict[str, Any]:
    finish = normalize_time(finish_time)
    code = result_status_code or status_code(finish)
    return {
        "athlete_name_snapshot": clean(athlete_name),
        "bib_number": clean(bib_number),
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class"),
        "round_label": context.get("round_label") or "决赛",
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
        "source_url": SOURCE_URL,
        "source_note": context["source_note"],
        "parse_confidence": 0.99,
        "review_status": "confirmed",
        "is_verified": True,
    }


def parse_result_line(line: str, context: dict[str, Any], page_number: int, status_index: int) -> tuple[dict[str, Any] | None, int]:
    text = clean(line)
    if not text or text.startswith(("名次 ", "裁判长", "起点裁判长", "终点裁判长", "航道裁判", "长距离赛成绩公告", "直道竞速赛成绩公告", "预决赛", "序号", "5月")):
        return None, status_index
    if re.fullmatch(r"\d{1,2}", text):
        return None, status_index

    ranked = re.match(r"^(\d{1,3})\s+([A-Z]\d{2,3})\s+(.+)$", text)
    if ranked:
        rank_raw, bib, tail = ranked.groups()
        tokens = tail.split()
        finish_index = next((idx for idx in range(len(tokens) - 1, -1, -1) if is_result_or_status(tokens[idx])), -1)
        if finish_index <= 0:
            return None, status_index
        name, team = split_name_team(" ".join(tokens[:finish_index]))
        finish = tokens[finish_index]
        note = clean(" ".join(tokens[finish_index + 1 :])) or None
        code = status_code(finish) or (status_code(note) if note else None)
        rank = int(rank_raw)
        if code:
            status_index += 1
            rank = 9000 + status_index
        return make_result(
            context,
            page_number=page_number,
            rank_position=rank,
            bib_number=bib,
            athlete_name=name,
            team_name=team,
            finish_time=finish,
            result_label=note,
            result_status_code=code,
        ), status_index

    unranked = re.match(r"^([A-Z]\d{2,3})\s+(.+)$", text)
    if not unranked:
        return None, status_index
    bib, tail = unranked.groups()
    tokens = tail.split()
    finish_index = next((idx for idx in range(len(tokens) - 1, -1, -1) if is_result_or_status(tokens[idx])), -1)
    if finish_index <= 0:
        return None, status_index
    name, team = split_name_team(" ".join(tokens[:finish_index]))
    finish = tokens[finish_index]
    note = clean(" ".join(tokens[finish_index + 1 :])) or None
    code = status_code(finish) or (status_code(note) if note else None)
    if not code:
        return None, status_index
    status_index += 1
    return make_result(
        context,
        page_number=page_number,
        rank_position=9000 + status_index,
        bib_number=bib,
        athlete_name=name,
        team_name=team,
        finish_time=finish,
        result_label=note,
        result_status_code=code,
    ), status_index


def parse_pdf(path: Path) -> dict[str, Any]:
    reader = PdfReader(str(path))
    if len(reader.pages) != 48:
        raise ValueError(f"Expected 48 pages, got {len(reader.pages)}")

    results: list[dict[str, Any]] = []
    modules: dict[str, int] = {}
    status_by_module: dict[str, int] = {}
    current: dict[str, Any] | None = None

    for page_number in range(19, 49):
        text = reader.pages[page_number - 1].extract_text() or ""
        for raw in text.splitlines():
            line = clean(raw)
            next_context = context_from_line(line)
            if next_context:
                current = next_context
                key = f"{current['discipline']}|{current['gender_group']}"
                status_by_module.setdefault(key, 0)
                modules.setdefault(key, 0)
                continue
            if not current:
                continue
            key = f"{current['discipline']}|{current['gender_group']}"
            parsed, status_by_module[key] = parse_result_line(line, current, page_number, status_by_module[key])
            if parsed:
                results.append(parsed)
                modules[key] = modules.get(key, 0) + 1
            elif re.match(r"^(?:\d{1,3}\s+)?[A-Z]\d{2,3}\s+", line):
                raise ValueError(f"Unparsed result row on page {page_number}: {line}")

    module_labels = sorted(f"{item.split('|')[0]} · {item.split('|')[1]}" for item in modules)
    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "start_date": "2026-05-16",
            "end_date": "2026-05-16",
            "province": "湖北省",
            "city": "宜昌市",
            "venue": "兴山县",
            "event_status": "completed",
            "result_status": "extended_complete",
            "source_scope": "用户提交成绩册导入",
            "result_source_note": "导入第19-48页长距离赛与200米直道竞速成绩；第1-18页积分/总排名仅用于核对，未导入积分。",
        },
        "source": {
            "original_path": str(path),
            "file_name": FILE_NAME,
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "result_submission_id": 20,
            "result_submission_batch_id": "mp_1780069066678_yxuj45bo",
            "parser_name": "parse-chutian-xingshan-2026-results.py",
            "parser_status": "parsed",
            "parser_note": "抽取第19-35页长距离成绩、第36-48页200米成绩；跳过第1-18页个人积分/总排名汇总。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "result_submission",
                "submission_id": 20,
                "result_submission_batch_id": "mp_1780069066678_yxuj45bo",
                "result_submission_folder": 1,
                "page_range": "19-48",
                "excluded_pages": "1-18积分/总排名",
                "modules": module_labels,
            },
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=PDF_PATH)
    parser.add_argument("-o", "--output", type=Path, default=Path(".cache/chutian-paddle-king-xingshan-2026-results.json"))
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
