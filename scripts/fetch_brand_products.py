#!/usr/bin/env python3
"""
SUP Wiki - 品牌官网产品图片抓取工具
用法: python3 scripts/fetch_brand_products.py

功能：
  1. 从品牌官网抓取产品图片（支持防盗链，自动设置 Referer）
  2. 上传到阿里云 OSS
  3. 通过管理员 API 更新产品记录

支持的抓取方式：
  - 直接 URL 下载（国际品牌官网图片）
  - 带 Referer 下载（国内品牌 CDN 防盗链）
  - Playwright 浏览器下载（需要 JS 渲染的页面）
"""

import urllib.request, json, time, subprocess, sys
from typing import Optional

# ── 配置 ────────────────────────────────────────────────────────
BASE_URL = "https://sup.iaddu.cn"
ADMIN_PASSWORD = "sup_wiki_admin_2026"  # 读取 .env.local 更安全

# ── 认证 ────────────────────────────────────────────────────────
def get_token() -> str:
    req = urllib.request.Request(
        f"{BASE_URL}/api/admin/login",
        data=json.dumps({"password": ADMIN_PASSWORD}).encode(),
        headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())["token"]


# ── 图片上传 ─────────────────────────────────────────────────────
def upload_image_from_url(
    img_url: str,
    token: str,
    referer: Optional[str] = None,
    folder: str = "products"
) -> str:
    """从 URL 下载图片并上传到 OSS，返回 OSS URL"""
    # 构建请求头
    headers = {"User-Agent": "Mozilla/5.0 (compatible; SUP-Wiki/1.0)"}
    if referer:
        headers["Referer"] = referer
    if img_url.startswith("//"):
        img_url = "https:" + img_url

    try:
        req = urllib.request.Request(img_url, headers=headers)
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read()

        if len(data) < 5000:
            print(f"  ✗ 图片太小({len(data)}B): {img_url[-50:]}")
            return ""

        ext = img_url.split("?")[0].split(".")[-1].lower()
        if ext not in ("jpg", "jpeg", "png", "webp"):
            ext = "jpg"
        mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                "png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg")

        bd = "----SUPBnd"
        body = (
            f"--{bd}\r\nContent-Disposition: form-data; name=\"folder\"\r\n\r\n{folder}\r\n"
            f"--{bd}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"img.{ext}\"\r\nContent-Type: {mime}\r\n\r\n"
        ).encode() + data + f"\r\n--{bd}--\r\n".encode()

        ureq = urllib.request.Request(
            f"{BASE_URL}/api/admin/upload", data=body,
            headers={"Authorization": f"Bearer {token}",
                     "Content-Type": f"multipart/form-data; boundary={bd}"},
            method="POST"
        )
        with urllib.request.urlopen(ureq, timeout=30) as r:
            result = json.loads(r.read())
            url = result.get("url", "")
            if url:
                print(f"  ✓ 上传成功 ({len(data)//1024}KB)")
            return url

    except Exception as e:
        print(f"  ✗ 错误: {e}")
        return ""


def upload_images_from_urls(
    img_urls: list[str],
    token: str,
    referer: Optional[str] = None,
    folder: str = "products",
    max_imgs: int = 3,
    delay: float = 0.5
) -> list[str]:
    """批量上传，返回成功上传的 OSS URL 列表"""
    oss_urls = []
    for url in img_urls:
        if len(oss_urls) >= max_imgs:
            break
        oss_url = upload_image_from_url(url, token, referer=referer, folder=folder)
        if oss_url:
            oss_urls.append(oss_url)
        time.sleep(delay)
    return oss_urls


# ── 产品更新 ─────────────────────────────────────────────────────
def update_product(product_id: int, data: dict, token: str) -> bool:
    req = urllib.request.Request(
        f"{BASE_URL}/api/admin/products/{product_id}",
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="PUT"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            result = json.loads(r.read())
            return result.get("success", False)
    except Exception as e:
        print(f"  ✗ 更新失败: {e}")
        return False


def get_products(token: str, brand_id: Optional[int] = None) -> list[dict]:
    """获取产品列表"""
    url = f"{BASE_URL}/api/admin/products?pageSize=100"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read())
    products = data.get("items", [])
    if brand_id:
        products = [p for p in products if p.get("brand_id") == brand_id]
    return products


# ── 品牌定义（可扩展） ─────────────────────────────────────────────
BRAND_CONFIGS = {
    "starboard": {
        "brand_id": 2,
        "website": "https://star-board.com",
        "referer": "https://star-board.com/",
        "img_base": "https://star-board.com/cdn/shop/files/",
    },
    "naish": {
        "brand_id": 4,
        "website": "https://www.naish.com",
        "referer": "https://www.naish.com/",
        "img_base": "https://www.naish.com/cdn/shop/files/",
    },
    "nsp": {
        "brand_id": 5,
        "website": "https://www.nspsurfboards.com",
        "referer": "https://www.nspsurfboards.com/",
        "img_base": "https://us.nspsurfboards.com/cdn/shop/files/",
    },
    "aztron": {
        "brand_id": 15,
        "website": "https://aztronsports.com",
        "referer": "https://aztronsports.com/",
        "img_base": "https://aztronsports.com/cdn/shop/files/",
    },
    "sunova": {
        "brand_id": 18,
        "website": "https://sunovasurfboards.com",
        "referer": "https://sunovasurfboards.com/",
        "img_base": "https://sunovasurfboards.com/cdn/shop/files/",
    },
    "aquamarina": {
        "brand_id": 6,
        "website": "https://aquamarina.com",
        "referer": "https://aquamarina.com/",
        "img_base": "https://aquamarina.com/wp-content/uploads/",
    },
    "chaoyang": {
        "brand_id": 16,
        "website": "https://zh.zyboats.com",
        "referer": "https://zh.zyboats.com/",
        "img_base": "https://omo-oss-image.thefastimg.com/portal-saas/pg2025041818083478464/cms/image/",
    },
}


# ── 示例使用 ─────────────────────────────────────────────────────
def example_update_single_product():
    """示例：给单个产品添加官网图片"""
    token = get_token()

    # 示例：更新 Starboard Sprint (product_id=5)
    img_urls = [
        "https://star-board.com/cdn/shop/files/2026-Starboard-SUP-Sprint-Inflatable-Deluxe-14-x-24_aa12a7a2-bdc8-4ea3-8ca4-39a601be6acd.jpg",
    ]

    oss_urls = upload_images_from_urls(
        img_urls, token,
        referer="https://star-board.com/",
        max_imgs=3
    )

    success = update_product(5, {
        "model": "Sprint Inflatable 14'0\" x 24\"",
        "images": oss_urls,
    }, token)

    print(f"更新结果: {'成功' if success else '失败'}")


def batch_update_from_config(updates: list[dict]):
    """
    批量更新产品图片

    updates 格式：
    [
        {
            "product_id": 34,
            "img_urls": ["url1", "url2", "url3"],
            "referer": "https://brand.com/",
            "spec": {"model": "...", "length_cm": 427, ...}  # 可选
        },
        ...
    ]
    """
    token = get_token()
    success_count = 0

    for item in updates:
        pid = item["product_id"]
        print(f"\n[#{pid}]")

        oss_urls = upload_images_from_urls(
            item["img_urls"], token,
            referer=item.get("referer"),
            max_imgs=item.get("max_imgs", 3)
        )

        payload = item.get("spec", {})
        payload["images"] = oss_urls

        if update_product(pid, payload, token):
            print(f"  ✅ 更新成功 ({len(oss_urls)} 张图片)")
            success_count += 1
        else:
            print(f"  ✗ 更新失败")

    print(f"\n完成：{success_count}/{len(updates)} 个产品更新成功")


if __name__ == "__main__":
    print("SUP Wiki 品牌产品图片更新工具")
    print("使用 batch_update_from_config() 批量更新产品")
    print("使用 example_update_single_product() 查看示例")
