#!/usr/bin/env python3
import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from pypdf import PdfReader


DEFAULT_PDF = "/tmp/kaizhou-2023-adult-college-long-distance.pdf"
DEFAULT_OUTPUT = ".cache/kaizhou-national-championship-2023-long-distance-results.json"
SOURCE_URL = "https://sport-hacker-assets.oss-cn-hangzhou.aliyuncs.com/sup-wiki/result-submissions/1/1780579276388-pjkk7w-2.2023---.pdf"
SUBMISSION_ID = 22
BATCH_ID = "mp_1780579275623_66l176k8"

SKIP_PREFIXES = (
    "2023全国",
    "长距离赛成绩单",
    "NO.1",
    "名次",
    "此表",
    "如有",
    "水温",
    "检录长",
    "裁判长",
)

STATUS_BASE = {
    "OTL": 8000,
    "DNF": 9000,
    "DNS": 10000,
    "DQ": 11000,
    "DSQ": 11000,
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Parse 2023 Kaizhou National SUP Championship long-distance results PDF."
    )
    parser.add_argument("--pdf", default=DEFAULT_PDF)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    return parser.parse_args()


def seconds_from_time(value):
    match = re.match(r"^(\d{2}):(\d{2}):(\d{2})$", value or "")
    if not match:
        return None
    hours, minutes, seconds = (int(part) for part in match.groups())
    return hours * 3600 + minutes * 60 + seconds


def normalize_group(title):
    match = re.match(r"^(.+?)组(男子|女子)长距离赛$", title)
    if not match:
        return title.replace("长距离赛", "")
    group_name, gender = match.groups()
    return f"{group_name}{gender}组"


def split_name_team(rest):
    tokens = rest.split()
    if len(tokens) < 2:
        raise ValueError(f"cannot split athlete/team: {rest}")

    name_tokens = [tokens[0]]
    index = 1
    while index < len(tokens):
        token = tokens[index]
        previous_is_ascii = bool(re.search(r"[A-Za-z]", name_tokens[-1]))
        token_is_ascii = bool(re.search(r"[A-Za-z]", token)) and not re.search(r"[\u4e00-\u9fff]", token)
        if token.startswith("·") or (previous_is_ascii and token_is_ascii):
            name_tokens.append(token)
            index += 1
            continue
        break

    if index >= len(tokens):
        raise ValueError(f"missing team: {rest}")

    if any(re.search(r"[\u4e00-\u9fff]", token) for token in name_tokens):
        name = "".join(name_tokens).replace(" ·", "·").replace("· ", "·")
    else:
        name = " ".join(name_tokens)
    team = "".join(tokens[index:])
    return name, team


def parse_row(candidate):
    match = re.match(
        r"^(?:(\d+)\s+)?([A-Z]\d{3,4})\s+(.+?)\s+((?:\d{2}:\d{2}:\d{2})|DNS|DNF|DQ|DSQ)(?:\s+(.*))?$",
        candidate,
    )
    if not match:
        return None
    rank_text, bib, rest, finish_time, note = match.groups()
    name, team = split_name_team(rest)
    status_code = None
    status_note = None
    if finish_time in {"DNS", "DNF", "DQ", "DSQ"}:
        status_code = finish_time
        status_note = None
    elif note and "关门" in note:
        status_code = "OTL"
        status_note = "关门"
    elif note:
        status_note = note.strip()
    return {
        "rank_text": rank_text,
        "bib_number": bib,
        "athlete_name_snapshot": name,
        "team_name": team,
        "finish_time": finish_time,
        "result_status_code": status_code,
        "result_status_note": status_note,
    }


def should_skip(line):
    return not line or line.startswith(SKIP_PREFIXES)


def candidate_starts(line):
    return bool(re.match(r"^(?:\d+\s+)?[A-Z]\d{3,4}\s+", line))


def build_result(row, group_title, page_number, status_seen):
    gender_group = normalize_group(group_title)
    rank_position = None
    if row["rank_text"]:
        rank_position = int(row["rank_text"])
    else:
        status_code = row["result_status_code"] or "OTL"
        status_seen[(gender_group, status_code)] += 1
        rank_position = STATUS_BASE.get(status_code, 12000) + status_seen[(gender_group, status_code)]

    return {
        "athlete_name_snapshot": row["athlete_name_snapshot"],
        "bib_number": row["bib_number"],
        "gender_group": gender_group,
        "discipline": "长距离赛",
        "board_class": "充气板" if group_title.startswith("充气板组") else None,
        "round_label": "决赛",
        "rank_position": rank_position,
        "result_label": row["result_status_code"],
        "finish_time": row["finish_time"],
        "result_status_code": row["result_status_code"],
        "result_status_note": row["result_status_note"],
        "time_seconds": seconds_from_time(row["finish_time"]),
        "points": None,
        "team_name": row["team_name"],
        "team_members": [],
        "nationality_snapshot": "中国",
        "source_locator": f"page:{page_number}",
        "source_note": f"{group_title} 地点：重庆·开州 时间：2023-11-05 08:00",
        "source_url": SOURCE_URL,
        "parse_confidence": 0.98,
        "review_status": "confirmed",
        "is_verified": True,
    }


def parse_pdf(pdf_path):
    reader = PdfReader(str(pdf_path))
    current_group = None
    status_seen = defaultdict(int)
    results = []
    errors = []

    for page_index, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        header = re.search(r"NO\.1\s+(.+?长距离赛)\s+地点：([^\n]+?)\s+时间：([^\n]+)", text)
        if header:
            current_group = header.group(1).strip()

        pending = ""
        for raw_line in text.splitlines():
            line = re.sub(r"\s+", " ", raw_line.strip())
            if should_skip(line):
                continue
            if line.startswith(("地点：", "时间：")):
                continue

            if candidate_starts(line):
                if pending:
                    errors.append({"page": page_index, "line": pending, "reason": "unparsed"})
                pending = line
            elif pending:
                pending = f"{pending} {line}"
            else:
                continue

            row = parse_row(pending)
            if row and current_group:
                results.append(build_result(row, current_group, page_index, status_seen))
                pending = ""

        if pending:
            row = parse_row(pending)
            if row and current_group:
                results.append(build_result(row, current_group, page_index, status_seen))
            else:
                errors.append({"page": page_index, "line": pending, "reason": "unparsed"})

    return results, errors, len(reader.pages)


def main():
    args = parse_args()
    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")

    results, errors, page_count = parse_pdf(pdf_path)
    if errors:
        preview = "\n".join(f"page {item['page']}: {item['line']}" for item in errors[:10])
        raise SystemExit(f"Unparsed lines: {len(errors)}\n{preview}")

    output = {
        "event": {
            "name": "2023全国桨板锦标赛（重庆开州）",
            "slug": "kaizhou-national-sup-championship-2023",
            "start_date": "2023-11-05",
            "end_date": "2023-11-05",
            "province": "重庆市",
            "city": "重庆市",
            "venue": "开州",
            "event_status": "completed",
            "result_status": "extended_complete",
            "source_scope": "用户上传成绩册导入",
            "result_source_note": "2023全国桨板锦标赛重庆开州长距离赛成绩单（非正式），覆盖成人与高校等长距离分组。",
            "star_level": 4,
            "score_coefficient": 1.0,
        },
        "source": {
            "original_path": str(pdf_path),
            "file_name": "2.2023开州全国锦标赛长距离赛成绩(成人-高校组）.pdf",
            "file_type": "pdf",
            "source_url": SOURCE_URL,
            "result_submission_id": SUBMISSION_ID,
            "result_submission_batch_id": BATCH_ID,
            "parser_name": "local-race-results-import",
            "parser_status": "parsed",
            "parser_note": f"PDF 共 {page_count} 页，解析全部长距离成绩；文件标注为非正式成绩单。",
            "extracted_rows": len(results),
            "imported_rows": len(results),
            "metadata": {
                "source_kind": "uploaded_result_book",
                "actual_parser_name": Path(__file__).name,
                "page_range": f"1-{page_count}",
                "event_slug": "kaizhou-national-sup-championship-2023",
                "result_submission_id": SUBMISSION_ID,
                "result_submission_batch_id": BATCH_ID,
            },
        },
        "results": results,
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    groups = Counter((item["gender_group"], item["board_class"] or "-") for item in results)
    statuses = Counter(item["result_status_code"] or "OK" for item in results)
    print(f"wrote {output_path}")
    print(f"rows {len(results)} groups {len(groups)}")
    print("statuses", dict(statuses))
    for (group, board), count in sorted(groups.items()):
        print(f"{group} board={board} rows={count}")


if __name__ == "__main__":
    main()
