#!/usr/bin/env python3
"""OCR and parse 2024 中国桨板冠军赛苏州站 personal result pages."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

import fitz


EVENT_ID = 239
SOURCE_ID = 300
EVENT_NAME = "2024中国桨板冠军赛苏州站"
SOURCE_URL = "/result-books/20240921期 中国桨板冠军赛苏州站/成绩总结册-2024年全国桨板冠军赛暨中国桨板精英赛苏州站(1).pdf"
ORIGINAL_PATH = "/Users/xhl/Downloads/桨板赛事/20240921期 中国桨板冠军赛苏州站/成绩总结册-2024年全国桨板冠军赛暨中国桨板精英赛苏州站(1).pdf"
FIRST_RESULT_PAGE = 53
LAST_RESULT_PAGE = 142

STATUS_LABELS = {
    "DNS": "未出发",
    "DNF": "未完赛",
    "DSQ": "取消成绩",
    "DQ": "取消成绩",
}
STATUS_CODES = set(STATUS_LABELS)

OCR_SWIFT = r'''
import Foundation
import Vision
import AppKit

if CommandLine.arguments.count < 2 { exit(2) }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let image = NSImage(contentsOf: url), let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(1) }
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "en-US"]
if #available(macOS 13.0, *) { request.revision = VNRecognizeTextRequestRevision3 }
let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do { try handler.perform([request]) } catch { fputs("perform failed: \(error)\n", stderr); exit(1) }
for obs in (request.results ?? []).sorted(by: { abs($0.boundingBox.midY - $1.boundingBox.midY) > 0.01 ? $0.boundingBox.midY > $1.boundingBox.midY : $0.boundingBox.minX < $1.boundingBox.minX }) {
  if let candidate = obs.topCandidates(1).first {
    let s = candidate.string.replacingOccurrences(of: "\t", with: " ")
    print(String(format:"%.6f\t%.6f\t%.6f\t%.6f\t%@", obs.boundingBox.minX, obs.boundingBox.minY, obs.boundingBox.width, obs.boundingBox.height, s))
  }
}
'''


def clean(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("．", ".").replace("：", ":")
    text = text.replace("O:", "0:").replace("o:", "0:")
    return re.sub(r"\s+", " ", text)


def normalize_group(value: str) -> str:
    text = clean(value)
    text = text.replace("U 12", "U12").replace("U 15", "U15").replace("U 9", "U9")
    replacements = {
        "公开组男子": "公开男子组",
        "公开组女子": "公开女子组",
        "大师组男子": "大师男子组",
        "大师组女子": "大师女子组",
        "高校组男子": "高校男子组",
        "高校组女子": "高校女子组",
        "卡胡纳组男子": "卡胡纳男子组",
        "卡胡纳组女子": "卡胡纳女子组",
        "U12男子": "U12组男子",
        "U12女子": "U12组女子",
        "U15男子": "U15组男子",
        "U15女子": "U15组女子",
        "U18男子": "U18组男子",
        "U18女子": "U18组女子",
        "U9男子": "U9组男子",
        "U9女子": "U9组女子",
        "大众组男子": "大众男子组",
        "大众组女子": "大众女子组",
        "大众组 男子": "大众男子组",
        "大众组 女子": "大众女子组",
        "男子大众组": "大众男子组",
        "女子大众组": "大众女子组",
        "大师组 男子": "大师男子组",
        "大师组 女子": "大师女子组",
    }
    for src, dest in replacements.items():
        text = text.replace(src, dest)
    return text


def normalize_finish(value: str) -> str:
    text = clean(value).upper().rstrip(".")
    text = text.replace("OO:", "00:").replace("O0:", "00:")
    text = text.replace("O1:", "01:").replace("O2:", "02:")
    if text in STATUS_CODES:
        return text
    match = re.fullmatch(r"(\d{1,2}):(\d{2}):(\d{2})\.(\d{2})", text)
    if match and match.group(1) == "00":
        return f"{match.group(2)}:{match.group(3)}.{match.group(4)}"
    return text


def strip_finish_from_team(team: str, finish_time: str) -> str:
    text = clean(team)
    variants = {clean(finish_time), normalize_finish(finish_time)}
    for variant in variants:
        if variant:
            text = clean(text.replace(variant, ""))
    text = re.sub(r"\b\d{1,2}:\d{2}:\d{2}(?:\.\d{1,3})?\b", "", text)
    text = re.sub(r"\b\d{1,2}:\d{2}(?:\.\d{1,3})?\b", "", text)
    return clean(text) or "个人"


def status_code(value: str) -> str | None:
    text = clean(value).upper()
    return text if text in STATUS_CODES else None


def is_time_or_status(value: str) -> bool:
    text = normalize_finish(value)
    return bool(status_code(text) or re.fullmatch(r"(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d{1,3})?", text))


def is_bib(value: str) -> bool:
    text = clean(value).upper()
    return bool(re.fullmatch(r"(?:[A-Z])?\d{2,4}|NULL", text))


def is_rank(value: str) -> bool:
    return bool(re.fullmatch(r"\d{1,3}", clean(value)))


def ensure_ocr_binary(cache_dir: Path) -> Path:
    source = cache_dir / "vision_ocr_tsv.swift"
    binary = cache_dir / "vision_ocr_tsv"
    if not source.exists() or source.read_text(encoding="utf-8") != OCR_SWIFT:
        source.write_text(OCR_SWIFT, encoding="utf-8")
    if not binary.exists() or binary.stat().st_mtime < source.stat().st_mtime:
        env = os.environ.copy()
        env["CLANG_MODULE_CACHE_PATH"] = str(cache_dir / "clang-module-cache")
        subprocess.run(["swiftc", str(source), "-o", str(binary)], check=True, env=env)
    return binary


def render_page(doc: fitz.Document, page_number: int, cache_dir: Path) -> Path:
    image_path = cache_dir / f"page-{page_number:03d}.png"
    if image_path.exists():
        return image_path
    page = doc[page_number - 1]
    pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), alpha=False)
    pix.save(str(image_path))
    return image_path


def ocr_page(doc: fitz.Document, page_number: int, cache_dir: Path, binary: Path) -> list[dict[str, Any]]:
    tsv_path = cache_dir / f"page-{page_number:03d}.tsv"
    if not tsv_path.exists():
        image_path = render_page(doc, page_number, cache_dir)
        output = subprocess.check_output([str(binary), str(image_path)], text=True)
        tsv_path.write_text(output, encoding="utf-8")
    observations: list[dict[str, Any]] = []
    text_lines: list[str] = []
    for line in tsv_path.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t", 4)
        if len(parts) != 5:
            continue
        x, y, w, h, text = parts
        item = {"x": float(x), "y": float(y), "w": float(w), "h": float(h), "text": clean(text)}
        if item["text"]:
            observations.append(item)
            text_lines.append(item["text"])
    (cache_dir / f"page-{page_number:03d}.txt").write_text("\n".join(text_lines), encoding="utf-8")
    return observations


def context_from_observations(observations: list[dict[str, Any]]) -> dict[str, Any] | None:
    text = " ".join(item["text"] for item in observations)
    title_text = " ".join(item["text"] for item in observations if item["y"] > 0.82) or text
    if "团队" in text or "接力赛" in text:
        return None
    if "环古城精英赛" in title_text:
        group = "女子组" if "女子组" in title_text else "男子组"
        return {"discipline": "16公里", "gender_group": group, "round_label": "决赛", "board_class": None}
    if "长距离成绩单" in title_text or re.search(r"[36]KM竞速赛", title_text, re.I):
        group = extract_group(title_text) or "公开组"
        km = re.search(r"([36])\s*KM", title_text, re.I)
        discipline = f"{km.group(1)}公里" if km else ("3公里" if "U12" in group or "U15" in group or "U9" in group else "6公里")
        return {"discipline": discipline, "gender_group": group, "round_label": "决赛", "board_class": None}
    if "趴板划水" in title_text or "趴板赛" in title_text:
        group = extract_group(title_text) or "公开组"
        round_label = "决赛"
        group_match = re.search(r"(预赛|半决赛|复赛)\s*第?\s*(\d+)组", title_text)
        if group_match:
            round_label = f"{group_match.group(1)}{group_match.group(2)}"
        elif "预赛" in title_text:
            round_label = "预赛"
        return {"discipline": "趴板划水", "gender_group": group, "round_label": round_label, "board_class": None}
    if "200M" in title_text.upper() or "200米" in title_text:
        group = extract_group(title_text) or "公开组"
        round_label = "决赛"
        group_match = re.search(r"(预赛|半决赛|复赛)\s*第?\s*(\d+)组", title_text)
        if group_match:
            round_label = f"{group_match.group(1)}{group_match.group(2)}"
        elif "半决赛" in title_text:
            round_label = "半决赛"
        elif "预赛" in title_text:
            round_label = "预赛"
        elif "复赛" in title_text:
            round_label = "复赛"
        return {"discipline": "200米", "gender_group": group, "round_label": round_label, "board_class": None}
    return None


def extract_group(text: str) -> str | None:
    patterns = [
        r"(公开组[男女]子)",
        r"(大师组\s*[男女]子)",
        r"(高校组[男女]子)",
        r"(卡胡纳组[男女]子)",
        r"(大众组\s*[男女]子)",
        r"([男女]子大众组)",
        r"(U\s*(?:9|12|15|18)\s*组?[男女]子)",
        r"(U\s*(?:9|12|15|18)[男女]子)",
        r"([男女]子组)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return normalize_group(match.group(1))
    return None


def row_groups(observations: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    body = [item for item in observations if 0.08 < item["y"] < 0.86]
    rows: list[list[dict[str, Any]]] = []
    for item in sorted(body, key=lambda v: -v["y"]):
        if not rows or abs(rows[-1][0]["y"] - item["y"]) > 0.010:
            rows.append([item])
        else:
            rows[-1].append(item)
    return [sorted(row, key=lambda v: v["x"]) for row in rows]


def choose_text(row: list[dict[str, Any]], start: float, end: float, *, time_only: bool = False, bib_only: bool = False, rank_only: bool = False) -> str | None:
    candidates = [item for item in row if start <= item["x"] < end]
    if time_only:
        candidates = [item for item in candidates if is_time_or_status(item["text"])]
    if bib_only:
        candidates = [item for item in candidates if is_bib(item["text"])]
    if rank_only:
        candidates = [item for item in candidates if is_rank(item["text"])]
    if not candidates:
        return None
    return clean(" ".join(item["text"] for item in candidates))


def parse_row(row: list[dict[str, Any]], context: dict[str, Any], page_number: int, fallback_rank: int) -> dict[str, Any] | None:
    texts = [item["text"] for item in row]
    joined = " ".join(texts)
    if any(word in joined for word in ["名次", "参赛号码", "运动员姓名", "代表队", "成绩", "裁判长"]):
        return None

    is_sprint = context["discipline"] in {"200米", "趴板划水"}
    if is_sprint:
        rank_text = choose_text(row, 0.10, 0.21, rank_only=True)
        bib = choose_text(row, 0.27, 0.38, bib_only=True) or choose_text(row, 0.20, 0.40, bib_only=True)
        name = choose_text(row, 0.34, 0.48)
        team = choose_text(row, 0.45, 0.72)
        finish = choose_text(row, 0.69, 0.86, time_only=True)
        lane = choose_text(row, 0.20, 0.28)
    else:
        rank_text = choose_text(row, 0.10, 0.19, rank_only=True)
        bib = choose_text(row, 0.20, 0.32, bib_only=True)
        name = choose_text(row, 0.31, 0.47)
        team = choose_text(row, 0.45, 0.74)
        finish = choose_text(row, 0.74, 0.88, time_only=True)
        lane = None

    if not finish:
        finish = next((item["text"] for item in row if item["x"] >= 0.62 and is_time_or_status(item["text"])), None)
    if not bib:
        bib = next((item["text"] for item in row if 0.18 <= item["x"] <= 0.40 and is_bib(item["text"])), None)
    if not name:
        name = next((item["text"] for item in row if 0.30 <= item["x"] <= 0.50 and not is_time_or_status(item["text"]) and not is_bib(item["text"]) and not is_rank(item["text"])), None)

    if not name or not finish:
        return None
    if name in {"个人", "MOLOKAI"}:
        return None
    finish_time = normalize_finish(finish)
    team = strip_finish_from_team(team or "个人", finish_time)
    name = clean(name)
    if team != "个人" and team in name:
        name = clean(name.replace(team, ""))
    if " " in name:
        first, rest = name.split(" ", 1)
        if rest and (rest == team or len(first) <= 8):
            name = first

    round_label = context["round_label"]
    if any(item["text"] == "预赛" and item["x"] < 0.25 for item in row):
        round_label = "预赛"
    elif any(item["text"] == "复赛" and item["x"] < 0.25 for item in row):
        round_label = "复赛"

    rank_position = int(rank_text) if rank_text and rank_text.isdigit() else fallback_rank
    code = status_code(finish_time)
    result_label_parts = []
    if lane and is_rank(lane):
        result_label_parts.append(f"出发位置 {lane}")
    if any(item["text"] == "Q" for item in row):
        result_label_parts.append("晋级")

    return {
        "athlete_name_snapshot": name,
        "bib_number": None if clean(bib or "").upper() == "NULL" else clean(bib or ""),
        "gender_group": context["gender_group"],
        "discipline": context["discipline"],
        "board_class": context.get("board_class"),
        "round_label": round_label,
        "rank_position": rank_position,
        "result_label": " ".join(result_label_parts) or None,
        "finish_time": finish_time,
        "result_status_code": code,
        "result_status_note": STATUS_LABELS.get(code or ""),
        "team_name": team,
        "team_members": [],
        "points": None,
        "source_locator": f"page:{page_number}",
        "parse_confidence": 0.82 if not rank_text or not bib else 0.9,
        "review_status": "confirmed",
        "source_note": "苏州站扫描成绩册第53页后本地OCR重解析",
    }


def parse_pdf(pdf_path: Path, cache_dir: Path) -> dict[str, Any]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    binary = ensure_ocr_binary(cache_dir)
    results: list[dict[str, Any]] = []
    page_counts: dict[str, int] = {}
    skipped_pages: dict[str, str] = {}
    doc = fitz.open(str(pdf_path))
    last_context: dict[str, Any] | None = None
    for page_number in range(FIRST_RESULT_PAGE, min(LAST_RESULT_PAGE, len(doc)) + 1):
        observations = ocr_page(doc, page_number, cache_dir, binary)
        context = context_from_observations(observations)
        page_text = " ".join(item["text"] for item in observations)
        if not context:
            if last_context and "团队" not in page_text and "接力赛" not in page_text and ("成绩单" in page_text or any(is_time_or_status(item["text"]) for item in observations)):
                context = dict(last_context)
            else:
                skipped_pages[str(page_number)] = "team_or_unknown"
                continue
        elif context["gender_group"] == "公开组" and last_context and context["discipline"] == last_context.get("discipline"):
            if not re.search(r"(公开组|大众组|大师组|高校组|卡胡纳组|U\s*(?:9|12|15|18)|[男女]子大众组)", page_text):
                context = dict(last_context)
        else:
            last_context = dict(context)
        status_fallback = 9000
        count = 0
        for row in row_groups(observations):
            item = parse_row(row, context, page_number, status_fallback)
            if not item:
                continue
            if status_code(item["finish_time"]) and item["rank_position"] < 9000 and not item["result_label"]:
                item["result_label"] = item["result_status_note"]
            if item["rank_position"] >= 9000:
                status_fallback += 1
                item["rank_position"] = status_fallback
            results.append(item)
            count += 1
        if count:
            page_counts[str(page_number)] = count
        else:
            skipped_pages[str(page_number)] = "no_rows"
    return {
        "event": {
            "event_id": EVENT_ID,
            "name": EVENT_NAME,
            "slug": "china-sup-championship-suzhou-2024",
            "province": "江苏省",
            "city": "苏州市",
            "start_date": "2024-09-21",
            "end_date": "2024-09-22",
        },
        "source": {
            "source_id": SOURCE_ID,
            "file_name": Path(ORIGINAL_PATH).name,
            "source_url": SOURCE_URL,
            "original_path": ORIGINAL_PATH,
            "parser_name": Path(__file__).name,
            "parser_note": "苏州站扫描版成绩总结册第53-142页本地OCR解析；团队接力页跳过，仅导入个人成绩。",
            "metadata": {"page_range": "53-142", "page_counts": page_counts, "skipped_pages": skipped_pages},
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", default=ORIGINAL_PATH)
    parser.add_argument("--cache-dir", default="/private/tmp/suzhou-championship-2024-ocr")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    payload = parse_pdf(Path(args.pdf), Path(args.cache_dir))
    Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"parsed {len(payload['results'])} results -> {args.output}")
    print(f"pages with rows: {len(payload['source']['metadata']['page_counts'])}; skipped: {len(payload['source']['metadata']['skipped_pages'])}")


if __name__ == "__main__":
    main()
