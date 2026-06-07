#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader


EVENT_NAME = "第二届杭州皮划艇大众公开赛"
EVENT_SLUG = "hangzhou-canoe-mass-open-2026"
BATCH_ID = "mp_1780814033934_6fype14i"
BASE_DIR = Path(".cache/result-submissions") / BATCH_ID

SUBMISSIONS = [
    {
        "submission_id": 25,
        "file": "01-open-women.pdf",
        "file_name": "成绩单-大众公开组女子（桨板）.pdf",
        "source_url": "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/result-submissions/1/1780814034841-x6ul5f-%E6%88%90%E7%BB%A9%E5%8D%95-%E5%A4%A7%E4%BC%97%E5%85%AC%E5%BC%80%E7%BB%84%E5%A5%B3%E5%AD%90-%E6%A1%A8%E6%9D%BF-.pdf",
    },
    {
        "submission_id": 26,
        "file": "02-open-men.pdf",
        "file_name": "成绩单-大众公开组男子（桨板）.pdf",
        "source_url": "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/result-submissions/1/1780814035761-z8hshu-%E6%88%90%E7%BB%A9%E5%8D%95-%E5%A4%A7%E4%BC%97%E5%85%AC%E5%BC%80%E7%BB%84%E7%94%B7%E5%AD%90-%E6%A1%A8%E6%9D%BF-.pdf",
    },
    {
        "submission_id": 27,
        "file": "03-master-women.pdf",
        "file_name": "成绩单-大众大师组女子（桨板）.pdf",
        "source_url": "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/result-submissions/1/1780814036530-vvsq9b-%E6%88%90%E7%BB%A9%E5%8D%95-%E5%A4%A7%E4%BC%97%E5%A4%A7%E5%B8%88%E7%BB%84%E5%A5%B3%E5%AD%90-%E6%A1%A8%E6%9D%BF-.pdf",
    },
    {
        "submission_id": 28,
        "file": "04-master-men.pdf",
        "file_name": "成绩单-大众大师组男子（桨板）.pdf",
        "source_url": "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/result-submissions/1/1780814037629-cje8me-%E6%88%90%E7%BB%A9%E5%8D%95-%E5%A4%A7%E4%BC%97%E5%A4%A7%E5%B8%88%E7%BB%84%E7%94%B7%E5%AD%90-%E6%A1%A8%E6%9D%BF-.pdf",
    },
]

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


def normalize_group(project: str) -> str:
    text = clean(project).replace(" ", "")
    if "公开组女子" in text:
        return "公开女子组"
    if "公开组男子" in text:
        return "公开男子组"
    if "大师组女子" in text:
        return "大师女子组"
    if "大师组男子" in text:
        return "大师男子组"
    raise ValueError(f"无法识别组别: {project}")


def parse_time_seconds(value: str) -> float | None:
    text = clean(value).upper()
    if text in STATUS_CODES:
        return None
    match = re.fullmatch(r"(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?", text)
    if not match:
        return None
    hours, minutes, seconds, fraction = match.groups()
    total = int(hours) * 3600 + int(minutes) * 60 + int(seconds)
    if fraction:
        total += float(f"0.{fraction}")
    return total


def context_from_text(text: str) -> dict[str, str]:
    date_match = re.search(r"日期[:：]\s*(\d{4})年(\d{2})月(\d{2})日\s+地点[:：]\s*(.+)", text)
    project_match = re.search(r"项目[:：]\s*(.+?)(?:\s+\d+艇|\n)", text)
    if not date_match or not project_match:
        raise ValueError("PDF 缺少日期/项目上下文")
    year, month, day, venue = date_match.groups()
    project = clean(project_match.group(1))
    return {
        "date": f"{year}-{month}-{day}",
        "venue": clean(venue),
        "gender_group": normalize_group(project),
        "discipline": "10公里",
        "source_note": project,
    }


def is_result_complete(text: str) -> bool:
    return bool(re.search(r"(?:\d{1,2}:\d{2}:\d{2}\.\d+\s+\d{3,4}|(?:\d{3,4}\s+)?(?:DNS|DNF|DQ|DSQ))(?:\s+\S+)?$", text))


def iter_result_lines(text: str) -> list[str]:
    lines = [clean(line) for line in text.splitlines()]
    rows: list[str] = []
    pending = ""
    in_table = False
    for line in lines:
        if not line:
            continue
        if line.startswith("名次 姓名 代表队"):
            in_table = True
            pending = ""
            continue
        if not in_table:
            continue
        if line.startswith(("第二届", "总裁判长", "起点裁判长", "终点裁判长", "编排裁判长", "航道裁判", "成绩公告", "RESULTS")):
            if pending and is_result_complete(pending):
                rows.append(pending)
            pending = ""
            continue
        candidate = clean(f"{pending} {line}" if pending else line)
        if is_result_complete(candidate):
            rows.append(candidate)
            pending = ""
        else:
            pending = candidate
    if pending and is_result_complete(pending):
        rows.append(pending)
    return rows


def split_name_team(prefix: str) -> tuple[str, str]:
    text = clean(prefix)
    if not text:
        return "", "个人"
    match = re.match(r"^([\u4e00-\u9fff·]{2,5})\s+(.+)$", text)
    if match:
        return clean(match.group(1)), clean(match.group(2)) or "个人"
    parts = text.split(" ", 1)
    return clean(parts[0]), clean(parts[1] if len(parts) > 1 else "个人") or "个人"


def parse_result_line(line: str, context: dict[str, str], page_number: int, status_index: int) -> tuple[dict[str, Any], int]:
    text = clean(line)
    ranked = re.match(r"^(\d{1,3})\s+(.+?)\s+(\d{1,2}:\d{2}:\d{2}\.\d+)\s+(\d{3,4})(?:\s+(.+))?$", text)
    if ranked:
        rank_raw, prefix, finish_time, bib_number, note = ranked.groups()
        name, team = split_name_team(prefix)
        rank_position = int(rank_raw)
        code = None
    else:
        status = re.match(r"^(.+?)\s+(\d{3,4})\s+(DNS|DNF|DQ|DSQ)(?:\s+(.+))?$", text)
        if not status:
            raise ValueError(f"无法解析成绩行 page:{page_number}: {line}")
        prefix, bib_number, code, note = status.groups()
        name, team = split_name_team(prefix)
        finish_time = code
        status_index += 1
        rank_position = 9000 + status_index

    if not name:
        raise ValueError(f"成绩行缺少姓名 page:{page_number}: {line}")
    return {
        "athlete_name_snapshot": name,
        "bib_number": clean(bib_number),
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": "桨板",
        "round_label": "决赛",
        "rank_position": rank_position,
        "result_label": clean(note) or None,
        "finish_time": clean(finish_time).upper(),
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code or ""),
        "time_seconds": parse_time_seconds(finish_time),
        "points": None,
        "team_name": team,
        "team_members": [],
        "nationality_snapshot": "中国",
        "source_locator": f"page:{page_number}",
        "source_note": context["source_note"],
        "parse_confidence": 0.99,
        "review_status": "confirmed",
        "is_verified": True,
    }, status_index


def parse_pdf(entry: dict[str, Any], base_dir: Path) -> dict[str, Any]:
    pdf_path = base_dir / entry["file"]
    reader = PdfReader(str(pdf_path))
    full_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    context = context_from_text(full_text)

    results: list[dict[str, Any]] = []
    status_index = 0
    for page_index, page in enumerate(reader.pages, start=1):
        for row in iter_result_lines(page.extract_text() or ""):
            result, status_index = parse_result_line(row, context, page_index, status_index)
            result["source_url"] = entry["source_url"]
            results.append(result)

    return {
        "event": {
            "name": EVENT_NAME,
            "slug": EVENT_SLUG,
            "start_date": context["date"],
            "end_date": context["date"],
            "province": "浙江省",
            "city": "杭州市",
            "venue": context["venue"],
            "event_status": "completed",
            "result_status": "extended_complete",
            "source_scope": "用户提交成绩册导入",
            "result_source_note": "导入用户提交的4份大众公开组/大师组单人桨板10公里成绩单。",
        },
        "source": {
            "original_path": str(pdf_path),
            "file_name": entry["file_name"],
            "file_type": "pdf",
            "source_url": entry["source_url"],
            "result_submission_id": entry["submission_id"],
            "result_submission_batch_id": BATCH_ID,
            "parser_name": "parse-hangzhou-canoe-mass-open-2026-sup-results.py",
            "parser_status": "parsed",
            "parser_note": f"解析{context['source_note']}，共{len(reader.pages)}页。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "result_submission",
                "result_submission_id": entry["submission_id"],
                "result_submission_batch_id": BATCH_ID,
                "page_range": f"1-{len(reader.pages)}",
                "module": f"{context['discipline']} · {context['gender_group']}",
            },
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-dir", type=Path, default=BASE_DIR)
    parser.add_argument("-o", "--output", type=Path, default=Path(".cache/hangzhou-canoe-mass-open-2026-results.jsonl"))
    args = parser.parse_args()

    payloads = [parse_pdf(entry, args.base_dir) for entry in SUBMISSIONS]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(json.dumps(payload, ensure_ascii=False) for payload in payloads) + "\n", encoding="utf-8")

    total = 0
    statuses: dict[str, int] = {}
    modules: dict[str, int] = {}
    for payload in payloads:
        rows = payload["results"]
        total += len(rows)
        for row in rows:
            statuses[row.get("result_status_code") or "OK"] = statuses.get(row.get("result_status_code") or "OK", 0) + 1
            key = f"{row['discipline']} · {row['gender_group']}"
            modules[key] = modules.get(key, 0) + 1
        print(f"{payload['source']['file_name']}: rows={len(rows)} module={payload['source']['metadata']['module']}")
    print(f"total={total} modules={len(modules)} statuses={statuses} output={args.output}")


if __name__ == "__main__":
    main()
