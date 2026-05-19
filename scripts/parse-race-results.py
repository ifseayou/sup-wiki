#!/usr/bin/env python3
"""Parse local SUP result books into import payloads.

The local directory is the canonical race-result source. Parseable PDF/Excel/TXT
files produce result rows. Image-only and unparseable files still produce source
records so the admin review queue can track them back to the original book.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import signal
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Any


EVENT_KEYWORDS = (
    "桨板", "SUP", "sup", "皮划艇桨板", "浆板",
)
RESULT_KEYWORDS = ("成绩", "成绩册", "成绩单", "成绩公告", "排名", "总成绩", "获奖名单", "龙虎榜")
IGNORE_FILE_KEYWORDS = ("气象", "照片", "技术会议", "会议", "奖金发放")
SKIP_DISCIPLINE_KEYWORDS = ("皮划艇", "独木舟", "龙舟")
SUP_KEYWORDS = ("桨板", "SUP", "sup")
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
EXCEL_EXTS = {".xlsx", ".xls"}
TIME_PATTERN = r"(?:\d+:)?\d{1,2}[:.]\d{2}(?:[.:]\d{1,3})?|\d+'\d+(?:\.\d+)?\"?|\d{1,3}(?:\.\d{1,3})"


class FileParseTimeout(Exception):
    pass


def classify_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return "pdf"
    if suffix in EXCEL_EXTS:
        return "excel"
    if suffix in IMAGE_EXTS:
        return "image"
    if suffix == ".txt":
        return "text"
    return "unknown"


def is_probable_result_file(path: Path) -> bool:
    text = str(path)
    if not any(k in text for k in EVENT_KEYWORDS):
        return False
    if any(k in path.name for k in IGNORE_FILE_KEYWORDS):
        return False
    if any(k in path.name for k in RESULT_KEYWORDS):
        return True
    if path.suffix.lower() in EXCEL_EXTS:
        return True
    return path.suffix.lower() in IMAGE_EXTS and any(k in path.parent.name for k in SUP_KEYWORDS)


def event_from_path(path: Path, root: Path) -> dict[str, Any]:
    try:
        rel = path.relative_to(root)
        first = rel.parts[0] if len(rel.parts) > 1 else path.parent.name
    except ValueError:
        first = path.parent.name
    date_match = re.search(r"(\d{4})(\d{2})(\d{2})", first)
    start_date = None
    if date_match:
        start_date = f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}"
    name = re.sub(r"^\d{8}\s*期?\s*", "", first).strip() or path.stem
    name = name.replace("2O026", "2026")
    return {
        "name": name,
        "start_date": start_date,
        "source_scope": "本地成绩册导入",
        "star_level": infer_star(name),
        "score_coefficient": infer_score(name),
    }


def infer_star(name: str) -> str | None:
    if "亚洲" in name:
        return "五星+"
    if any(k in name for k in ("全国", "冠军", "超级联赛")):
        return "五星"
    if any(k in name for k in ("俱乐部联赛", "百城", "中国桨板公开赛")):
        return "四星+"
    if any(k in name for k in ("省", "长三角", "精英赛")):
        return "四星"
    return "三星"


def infer_score(name: str) -> float | None:
    mapping = {"五星+": 5.5, "五星": 5.0, "四星+": 4.5, "四星": 4.0, "三星": 3.0}
    star = infer_star(name)
    return mapping.get(star or "")


def normalize_result_row(row: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    row = normalize_keys(row)
    name = clean_cell(row.get("姓名") or row.get("运动员姓名") or row.get("运动员") or row.get("name") or "")
    rank_raw = clean_cell(row.get("名次") or row.get("排名") or row.get("rank") or "")
    finish = clean_cell(row.get("成绩") or row.get("赛会成绩") or row.get("finish_time") or row.get("用时") or "")
    if not name or not rank_raw or not finish:
        return None
    if is_non_result(rank_raw):
        return None
    try:
        rank = int(float(rank_raw))
    except ValueError:
        return None
    title = context.get("sheet") or context.get("title") or context.get("file_name") or ""
    if is_non_sup_context(str(title)):
        return None
    return {
        "athlete_name_snapshot": name,
        "bib_number": clean_cell(row.get("参赛号") or row.get("号码") or row.get("参赛号码") or row.get("号码布") or "") or None,
        "gender_group": context.get("gender_group") or infer_gender(str(title)),
        "discipline": context.get("discipline") or infer_discipline(str(title)),
        "board_class": context.get("board_class") or infer_board_class(str(title)),
        "round_label": context.get("round_label"),
        "rank_position": rank,
        "result_label": clean_cell(row.get("备注") or row.get("备注1") or row.get("成绩说明") or "") or None,
        "finish_time": finish,
        "team_name": clean_cell(row.get("代表队") or row.get("代表单位/地区") or row.get("单位") or row.get("队伍") or row.get("俱乐部") or "") or None,
        "points": parse_number(row.get("积分") or row.get("总积分")),
        "source_locator": context.get("locator"),
        "parse_confidence": 0.86,
        "review_status": "confirmed",
    }


def normalize_keys(row: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in row.items():
        clean_key = clean_cell(key).replace("\n", "").replace(" ", "")
        normalized[clean_key] = value
    return normalized


def clean_cell(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() == "nan":
        return ""
    return re.sub(r"\s+", " ", text)


def is_non_result(value: str) -> bool:
    return value.upper() in {"/", "·", "-", "DNS", "DNF", "DQ", "DNQ"}


def is_non_sup_context(text: str) -> bool:
    if any(k in text for k in SUP_KEYWORDS):
        return False
    return any(k in text for k in SKIP_DISCIPLINE_KEYWORDS)


def infer_gender(text: str) -> str:
    if "女子" in text:
        return "女子组"
    if "男子" in text:
        return "男子组"
    return "公开组"


def infer_discipline(text: str) -> str:
    match = re.search(r"(\d+(?:\.\d+)?)\s*(米|m|M|公里|KM|km|K)", text)
    if match:
        unit = match.group(2).lower()
        value = match.group(1)
        if unit in {"公里", "km", "k"}:
            return f"{value}公里"
        return f"{value}米"
    if "长距离" in text:
        return "长距离"
    if "竞速" in text or "冲刺" in text:
        return "竞速赛"
    return text[:40] or "未分项目"


def infer_board_class(text: str) -> str | None:
    for label in ("硬板", "充气板", "救生板", "竞速板", "龙板"):
        if label in text:
            return label
    return None


def infer_round(text: str) -> str | None:
    for label in ("预赛", "半决赛", "决赛", "总决赛", "初赛", "排名赛"):
        if label in text:
            return label
    return None


def parse_number(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text == "/":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_excel(path: Path) -> list[dict[str, Any]]:
    import pandas as pd

    results: list[dict[str, Any]] = []
    sheets = pd.read_excel(path, sheet_name=None, header=None)
    for sheet_name, df in sheets.items():
        df = df.dropna(how="all")
        if df.empty:
            continue
        header_idx = None
        for idx, row in df.iterrows():
            values = [str(v).strip() for v in row.tolist()]
            if "姓名" in values and any(v in values for v in ("名次", "排名")):
                header_idx = idx
                break
        if header_idx is None:
            continue
        header = [str(v).strip() for v in df.loc[header_idx].tolist()]
        body = df.loc[header_idx + 1 :].copy()
        body.columns = header
        for _, item in body.iterrows():
            parsed = normalize_result_row(item.to_dict(), {"sheet": sheet_name, "locator": f"sheet:{sheet_name}"})
            if parsed:
                results.append(parsed)
    return results


def parse_pdf(path: Path) -> list[dict[str, Any]]:
    import pdfplumber

    results: list[dict[str, Any]] = []
    with pdfplumber.open(path) as pdf:
        for index, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            title = text.split("\n")[:8]
            page_title = " ".join(title)
            tables = page.extract_tables() or []
            for table in tables:
                if not table or len(table) < 2:
                    continue
                header_index = find_header_index(table)
                if header_index is None:
                    continue
                header = [clean_cell(v).replace("\n", "") for v in table[header_index]]
                for row in table[header_index + 1:]:
                    item = {header[i]: row[i] if i < len(row) else "" for i in range(len(header))}
                    parsed = normalize_result_row(item, {
                        "title": page_title,
                        "locator": f"page:{index}",
                        "round_label": infer_round(page_title),
                    })
                    if parsed:
                        results.append(parsed)
            results.extend(parse_pdf_text_page(text, index))
    return results


def find_header_index(table: list[list[Any]]) -> int | None:
    for idx, row in enumerate(table[:5]):
        header = "".join(clean_cell(v).replace("\n", "") for v in row)
        if "姓名" in header and ("名次" in header or "排名" in header):
            return idx
    return None


def parse_pdf_text_page(text: str, page_number: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = " ".join(lines[:8])
    pattern = re.compile(rf"^(\d+)\s+([A-Z]?\d{{1,4}})?\s*([\u4e00-\u9fa5A-Za-z·]{{2,30}})\s+(.+?)\s+({TIME_PATTERN})$")
    lane_pattern = re.compile(rf"^(\d+)\s+\d+\s+([A-Z]?\d{{1,4}})\s+([\u4e00-\u9fa5A-Za-z·]{{2,30}})\s+(.+?)\s+({TIME_PATTERN})$")
    compact_pattern = re.compile(rf"^(\d+)\s+([A-Z]?\d{{1,4}})?\s*([\u4e00-\u9fa5A-Za-z·]{{2,30}})\s+({TIME_PATTERN})$")
    for line in lines:
        if not looks_like_result_line(line):
            continue
        match = lane_pattern.match(line) or pattern.match(line) or compact_pattern.match(line)
        if not match:
            continue
        groups = match.groups()
        if len(groups) == 5:
            rank, bib, name, team, finish = groups
        else:
            rank, bib, name, finish = groups
            team = ""
        parsed = normalize_result_row(
            {"名次": rank, "号码": bib or "", "姓名": name, "代表队": team, "成绩": finish},
            {"title": title, "locator": f"page:{page_number}", "round_label": infer_round(title)},
        )
        if parsed:
            parsed["parse_confidence"] = 0.72
            parsed["review_status"] = "needs_review"
            out.append(parsed)
    return out


def looks_like_result_line(line: str) -> bool:
    if not re.match(r"^\d{1,3}\s+", line):
        return False
    return bool(re.search(TIME_PATTERN, line))


def parse_one(path: Path, root: Path) -> dict[str, Any] | None:
    file_type = classify_file(path)
    if not is_probable_result_file(path):
        return None
    if any(k in path.name for k in SKIP_DISCIPLINE_KEYWORDS) and "桨板" not in path.name:
        return None
    results: list[dict[str, Any]] = []
    note = ""
    status = "pending_review"
    try:
        if file_type == "excel":
            results = parse_excel(path)
        elif file_type == "pdf":
            results = parse_pdf(path)
        elif file_type == "text":
            text = path.read_text(encoding="utf-8", errors="ignore")
            results = parse_pdf_text_page(text, 1)
        else:
            note = "图片或未知格式，需后台人工复核"
    except Exception as exc:  # noqa: BLE001
        note = f"解析失败：{exc}"
        status = "failed"
    if results:
        results = dedupe_results(results)
        status = "parsed"
    return {
        "event": event_from_path(path, root),
        "source": {
            "original_path": str(path),
            "file_name": path.name,
            "file_type": file_type,
            "parser_name": "parse-race-results.py",
            "parser_status": status,
            "parser_note": note,
            "extracted_rows": len(results),
            "source_kind": "local_result_book",
            "metadata": {"relative_path": str(path.relative_to(root)) if path.is_relative_to(root) else str(path)},
        },
        "results": results,
    }


def dedupe_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    deduped = []
    for item in results:
        key = (
            item.get("gender_group"),
            item.get("discipline"),
            item.get("round_label"),
            item.get("rank_position"),
            item.get("athlete_name_snapshot"),
            item.get("finish_time"),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def cache_key(path: Path) -> str:
    stat = path.stat()
    raw = f"{path.resolve()}:{stat.st_mtime_ns}:{stat.st_size}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def pending_payload(path: Path, root: Path, note: str, status: str = "pending_review") -> dict[str, Any]:
    return {
        "event": event_from_path(path, root),
        "source": {
            "original_path": str(path),
            "file_name": path.name,
            "file_type": classify_file(path),
            "parser_name": "parse-race-results.py",
            "parser_status": status,
            "parser_note": note,
            "extracted_rows": 0,
            "source_kind": "local_result_book",
            "metadata": {"relative_path": str(path.relative_to(root)) if path.is_relative_to(root) else str(path)},
        },
        "results": [],
    }


def parse_with_timeout(path: Path, root: Path, timeout_seconds: int) -> dict[str, Any] | None:
    if timeout_seconds <= 0:
        return parse_one(path, root)

    def handle_timeout(_signum: int, _frame: Any) -> None:
        raise FileParseTimeout(f"单文件解析超过 {timeout_seconds} 秒，已转入待复核")

    previous = signal.signal(signal.SIGALRM, handle_timeout)
    signal.alarm(timeout_seconds)
    try:
        return parse_one(path, root)
    except FileParseTimeout as exc:
        if not is_probable_result_file(path):
            return None
        return pending_payload(path, root, str(exc))
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous)


def parse_cached_worker(args: tuple[str, str, str, int, bool]) -> dict[str, Any]:
    path_str, root_str, cache_dir_str, timeout_seconds, refresh = args
    path = Path(path_str)
    root = Path(root_str)
    cache_dir = Path(cache_dir_str)
    key = cache_key(path)
    cache_path = cache_dir / f"{key}.json"

    if cache_path.exists() and not refresh:
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        cached["cache_hit"] = True
        return cached

    try:
        payload = parse_with_timeout(path, root, timeout_seconds)
        cached = {
            "cache_hit": False,
            "path": str(path),
            "payload": payload,
            "status": payload["source"]["parser_status"] if payload else "ignored",
            "rows": len(payload.get("results", [])) if payload else 0,
        }
    except Exception as exc:  # noqa: BLE001
        payload = pending_payload(path, root, f"解析失败：{exc}", "failed") if is_probable_result_file(path) else None
        cached = {
            "cache_hit": False,
            "path": str(path),
            "payload": payload,
            "status": payload["source"]["parser_status"] if payload else "ignored",
            "rows": 0,
        }

    cache_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = cache_path.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(cached, ensure_ascii=False), encoding="utf-8")
    tmp_path.replace(cache_path)
    return cached


def copy_source_file(path: Path, root: Path, public_root: Path) -> str:
    rel = path.relative_to(root) if path.is_relative_to(root) else Path(path.name)
    dest = public_root / "result-books" / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists() or dest.stat().st_size != path.stat().st_size:
        shutil.copy2(path, dest)
    return "/" + str(dest.relative_to(public_root)).replace("\\", "/")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("-o", "--output", type=Path, default=Path("race-results-import.json"))
    parser.add_argument("--jsonl", action="store_true", help="write one payload per line")
    parser.add_argument("--copy-to-public", type=Path, help="copy source files under this public directory and set source_url")
    parser.add_argument("--limit", type=int, default=0, help="stop after N payloads for quick validation")
    parser.add_argument("--workers", type=int, default=4, help="number of parallel parser workers")
    parser.add_argument("--cache-dir", type=Path, default=Path(".cache/race-results-parse"), help="per-file parse cache directory")
    parser.add_argument("--refresh", action="store_true", help="ignore existing per-file cache")
    parser.add_argument("--file-timeout", type=int, default=45, help="seconds allowed per file before pending_review")
    args = parser.parse_args()
    payloads = []
    paths = [args.root] if args.root.is_file() else sorted(
        path for path in args.root.rglob("*") if path.is_file() and classify_file(path) != "unknown"
    )
    if args.limit:
        paths = paths[:args.limit]
    scan_root = args.root.parent if args.root.is_file() else args.root
    args.cache_dir.mkdir(parents=True, exist_ok=True)

    worker_args = [
        (str(path), str(scan_root), str(args.cache_dir), args.file_timeout, args.refresh)
        for path in paths
    ]
    completed = 0
    with ProcessPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = [executor.submit(parse_cached_worker, item) for item in worker_args]
        for future in as_completed(futures):
            completed += 1
            cached = future.result()
            item = cached.get("payload")
            marker = "cache" if cached.get("cache_hit") else "parse"
            print(
                f"{completed:03d}/{len(futures):03d} {marker} {cached.get('status')} rows={cached.get('rows')} {Path(cached.get('path', '')).name}",
                file=sys.stderr,
                flush=True,
            )
            if item:
                if args.copy_to_public:
                    item["source"]["source_url"] = copy_source_file(Path(cached["path"]), scan_root, args.copy_to_public)
                payloads.append(item)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.jsonl:
        args.output.write_text("\n".join(json.dumps(item, ensure_ascii=False) for item in payloads) + "\n", encoding="utf-8")
    else:
        args.output.write_text(json.dumps(payloads, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(payloads)} payloads to {args.output}")


if __name__ == "__main__":
    main()
