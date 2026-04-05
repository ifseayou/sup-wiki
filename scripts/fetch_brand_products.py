#!/usr/bin/env python3
"""
SUP Wiki - 品牌官网产品图片抓取工具
用法: python3 scripts/fetch_brand_products.py

功能：
  1. 从各品牌官网抓取产品图片（支持防盗链 Referer、JS 渲染页面）
  2. 上传到阿里云 OSS
  3. 通过管理员 API 更新产品记录

脚本内置了每个品牌的官网导航知识（产品列表页URL、图片提取规律等）。
"""

import urllib.request, json, time

# ════════════════════════════════════════════════════════════════
# 品牌导航知识库
# 每个品牌记录：
#   website      官方网站
#   products_url 产品列表页（直接可访问的）
#   referer      下载图片时需要的 Referer（防盗链用）
#   img_base     图片 CDN 前缀（可选，有些品牌图片 URL 有固定前缀）
#   img_pattern  图片 URL 规律说明
#   notes        特殊说明（访问方式、反爬注意事项等）
#   products     已知产品页面（逐步补充）
# ════════════════════════════════════════════════════════════════
BRAND_GUIDE = {

    # ── 国际品牌 ──────────────────────────────────────────────────

    "starboard": {
        "brand_id": 2,
        "website": "https://star-board.com",
        "products_url": "https://star-board.com/collections/inflatable-paddleboards",
        "hard_boards_url": "https://star-board.com/collections/hard-paddle-boards",
        "referer": "https://star-board.com/",
        "img_base": "https://star-board.com/cdn/shop/files/",
        "img_pattern": "图片 URL 格式: https://star-board.com/cdn/shop/files/[filename].jpg?v=[version]",
        "notes": "Shopify 架构，图片 URL 稳定可直接下载，无防盗链问题。"
                 "产品页 URL 格式: /products/2025-[model-name]",
        "products": {
            "Sprint Inflatable 14'": "https://star-board.com/products/2026-sprint-inflatable-paddle-board",
            "All Star Inflatable 14'": "https://star-board.com/products/2026-all-star-inflatable-paddle-board",
            "iGO Inflatable": "https://star-board.com/products/2026-igo-inflatable-paddleboard",
            "Generation Inflatable 12'6\"": "https://star-board.com/products/2025-generation-inflatable-paddle-board",
            "Touring Inflatable": "https://star-board.com/products/2026-touring-inflatable-paddleboard",
            "Surf Inflatable": "https://star-board.com/products/2025-surf-inflatable-paddle-board",
        },
    },

    "naish": {
        "brand_id": 4,
        "website": "https://www.naish.com",
        "products_url": "https://www.naish.com/collections/sup-paddle-boards",
        "referer": "https://www.naish.com/",
        "img_base": "https://www.naish.com/cdn/shop/files/",
        "img_pattern": "Shopify CDN，格式: /cdn/shop/files/[year]-[model]-naish-com-[n].jpg",
        "notes": "Shopify 架构，无防盗链。产品 URL 格式: /products/[year]-[model]",
        "products": {
            "Javelin Carbon 14'": "https://www.naish.com/products/2024-javelin-carbon",
            "Nalu S-Glass 9'": "https://www.naish.com/products/2024-nalu",
            "Crossover iSUP 12'": "https://www.naish.com/products/2024-crossover-isup",
            "Nalu GS": "https://www.naish.com/products/2024-nalu-gs",
            "Touring iSUP": "https://www.naish.com/products/2024-touring-isup",
        },
    },

    "nsp": {
        "brand_id": 5,
        "website": "https://www.nspsurfboards.com",
        "products_url": "https://us.nspsurfboards.com/collections/sup",
        "referer": "https://us.nspsurfboards.com/",
        "img_base": "https://us.nspsurfboards.com/cdn/shop/files/",
        "img_pattern": "Shopify CDN，格式: /cdn/shop/files/1600x1600_[BoardName]_[color].png",
        "notes": "主站 nspsurfboards.com 有访问限制（403），用美国站 us.nspsurfboards.com。"
                 "图片质量高，1600x1600 分辨率。",
        "products": {
            "O2 Allrounder LT 10'6\"": "https://www.poseidonstandup.com/products/nsp-all-around-98-o2-sup",
            "Sonic Pro Carbon 14'": "https://us.nspsurfboards.com/products/sonic-pro-carbon-2021",
            "Allrounder CocoFlax": "https://us.nspsurfboards.com/products/nsp-allrounder-cocoflax",
            "Performance Race FSL": "https://us.nspsurfboards.com/products/performance-race-fsl",
        },
    },

    "aztron": {
        "brand_id": 15,
        "website": "https://aztronsports.com",
        "products_url": "https://aztronsports.com/collections/sup",
        "referer": "https://aztronsports.com/",
        "img_base": "https://aztronsports.com/cdn/shop/files/",
        "img_pattern": "Shopify CDN，格式: /cdn/shop/files/1600X1600_[ModelName]-[n].png",
        "notes": "Shopify 架构，图片为 PNG，高清 1600x1600。"
                 "偶尔有 CDN 超时，重试即可。",
        "products": {
            "Mercury 3.0 10'10\"": "https://aztronsports.com/products/mercury2-0",
            "Lightspeed 2.0 14'": "https://aztronsports.com/products/lightspeed",
            "Titan 3.0 11'11\"": "https://aztronsports.com/products/titan2-0",
            "Soleil Windsurf": "https://aztronsports.com/products/soleil",
            "Neptune": "https://aztronsports.com/collections/sup",
        },
    },

    "sunova": {
        "brand_id": 18,
        "website": "https://sunovasurfboards.com",
        "products_url": "https://sunovasurfboards.com/en-us/collections/boards",
        "referer": "https://sunovasurfboards.com/",
        "img_base": "https://sunovasurfboards.com/cdn/shop/files/",
        "img_pattern": "Shopify CDN，格式: /cdn/shop/files/product-detail_[model]_01-overview_2x_[uuid].png",
        "notes": "Shopify 架构，PNG 格式。URL 中含随机 UUID，需从产品页提取。",
        "products": {
            "Casey Flow": "https://sunovasurfboards.com/en-us/products/flow",
            "Allround Faast Pro 14'": "https://sunovasurfboards.com/en-us/products/allround-faast-pro",
            "Flatwater Faast Pro 14'": "https://sunovasurfboards.com/en-us/products/flatwater-faast-pro",
            "Ocean Faast Pro": "https://sunovasurfboards.com/en-us/products/allwater-faast-pro",
        },
    },

    "aquamarina": {
        "brand_id": 6,
        "website": "https://aquamarina.com",
        "products_url": "https://aquamarina.com/sup/",
        "referer": "https://aquamarina.com/",
        "img_base": "https://aquamarina.com/wp-content/uploads/",
        "img_pattern": "WordPress 图片，格式: /wp-content/uploads/[year]/[month]/[model]-[n].png",
        "notes": "WordPress 架构，图片在 wp-content/uploads 目录。"
                 "部分产品页图片为 PNG，质量良好。",
        "products": {
            "Beast 10'6\"": "https://aquamarina.com/products/advanced-all-around/beast/",
            "Race 14'": "https://aquamarina.com/products/racing/race/",
            "Race Elite 14'": "https://aquamarina.com/products/racing/race-elite/",
            "Hyper 12'6\"": "https://aquamarina.com/products/touring/hyper/",
            "Atlas": "https://aquamarina.com/products/all-around-advanced/atlas/",
            "Blade": "https://aquamarina.com/products/blade/",
        },
    },

    # ── 中国品牌 ──────────────────────────────────────────────────

    "chaoyang": {
        "brand_id": 16,
        "website": "https://zh.zyboats.com",
        "products_url": "https://zh.zyboats.com/Products/39.html",
        "referer": "https://zh.zyboats.com/",
        "img_base": "https://omo-oss-image.thefastimg.com/portal-saas/pg2025041818083478464/cms/image/",
        "img_pattern": "防盗链 CDN（omo-oss-image.thefastimg.com），必须带 Referer=zh.zyboats.com 才能下载。"
                       "图片 URL 格式: [img_base][uuid].webp",
        "notes": "ZHAO MARINE（朝阳船艇）官网。产品列表页: /Products/39.html（SUP桨板分类）。"
                 "各产品详情页: /Products_details/[94-103].html",
        "products": {
            "休闲板 11'": "https://zh.zyboats.com/Products_details/94.html",
            "情侣板": "https://zh.zyboats.com/Products_details/95.html",
            "瑜伽板 11'6\"": "https://zh.zyboats.com/Products_details/96.html",
            "晋级板": "https://zh.zyboats.com/Products_details/97.html",
            "白水板": "https://zh.zyboats.com/Products_details/98.html",
            "竞速板 14'": "https://zh.zyboats.com/Products_details/99.html",
            "滑行板": "https://zh.zyboats.com/Products_details/100.html",
            "儿童板": "https://zh.zyboats.com/Products_details/101.html",
            "巴适板": "https://zh.zyboats.com/Products_details/102.html",
            "龙板 23'": "https://zh.zyboats.com/Products_details/103.html",
        },
        "known_images": {
            # 已验证可用（带 Referer 下载）
            "竞速板": [
                "a79f8972-b423-4c3f-bbdf-2620d226561c.webp",
                "2cd73e9f-4170-426c-aa58-c9cd9413bfc3.webp",
                "254ed367-104b-4b6c-ae82-40445b34a4c2.webp",
                "9c8ef336-82af-4aa5-be9c-f66e90ceeaf9.webp",
            ],
            "休闲板": [
                "59f4565e-5b42-4750-9cb1-68d9d585a98f.webp",
                "7c6fc074-6340-4ce9-b647-f685832fc3a7.webp",
                "15bf758f-5138-4c03-b9ff-afb6edc86be6.webp",
            ],
            "龙板": [
                "3498700c-c29a-483a-9720-435432c9072b.webp",
                "bdc6e67b-3ae9-43a6-9323-ac19711026ab.webp",
                "440f97d2-b0ba-4d24-b16e-dfdc419e70a6.webp",
            ],
            "瑜伽板": [
                "331a6cd3-ed4d-4358-974f-32fac760263b.webp",
                "5e32ce44-1e95-4e33-9fb2-920cfb5b1422.webp",
                "f07c8a82-e358-4d3c-9799-1ee4560d4fc0.webp",
            ],
        },
    },

    "waterlife": {
        "brand_id": 14,
        "website": "http://waterlivesports.com",
        "products_url": "http://waterlivesports.com/h-col-132.html",
        "referer": "http://waterlivesports.com/",
        "img_base": "",
        "img_pattern": "SSL 证书已过期（2025年），WebFetch 无法直接访问。"
                       "可选方案：①等待证书续期后抓取；②从淘宝/天猫官方旗舰店手动获取图片",
        "notes": "维特拉（WATERLIFE）官网 SSL 证书过期，无法直接下载。"
                 "淘宝搜索'维特拉桨板官方旗舰店'可找到产品图。",
        "products": {
            "朱墨PRO 12'6\"": "https://item.taobao.com/（搜索：维特拉朱墨PRO竞速桨板）",
            "朱墨 14'": "https://item.taobao.com/（搜索：维特拉朱墨14尺竞速）",
        },
        "status": "SSL_EXPIRED",
    },

    "molokai": {
        "brand_id": 8,
        "website": "http://www.molokaisport.cn",
        "products_url": "http://www.molokaisport.cn/other.html",
        "referer": "http://www.molokaisport.cn/",
        "img_base": "",
        "img_pattern": "SSL 握手失败（TLS 版本不兼容），WebFetch 无法访问。"
                       "可用 curl --tlsv1.0 或 --insecure 标志访问",
        "notes": "MOLOKAI 宁波蓝客优选体育，官网 SSL 配置问题。"
                 "备用抓取方式：①molokaisports.com（英文站，SSL 正常）"
                 "②从京东/天猫 MOLOKAI 官方店获取产品图",
        "products": {
            "FINDER AIR 11'6\"": "http://www.molokaisport.com/ll/20211022091010.html",
            "HERO AIR 14'": "http://www.molokaisport.com/（需进入产品页）",
        },
        "alternative_sites": [
            "https://whatzsup.com.hk/brand/molokai/",
            "https://goodwave.com.au/collections/molokai",
        ],
        "status": "TLS_ISSUE",
    },

    "transeboats": {
        "brand_id": 17,
        "website": "http://www.transeboats.com",
        "products_url": "http://www.transeboats.com/products.html",
        "referer": "http://www.transeboats.com/",
        "img_base": "",
        "img_pattern": "SSL 握手失败，WebFetch 无法访问。"
                       "建议通过淘宝'创意桨板官方店'获取产品图",
        "notes": "创意（Transe）品牌官网 SSL 问题，实际产品在国内电商平台销售。"
                 "产品图最佳来源：淘宝/拼多多搜索'创意 充气桨板 10尺6'",
        "status": "TLS_ISSUE",
    },

    "wangzhezhi": {
        "brand_id": 11,
        "website": None,
        "products_url": None,
        "img_pattern": "该品牌无独立官网，产品图来源：淘宝/拼多多搜索'王者之舟桨板'",
        "notes": "王者之舟主要在国内电商平台（淘宝/拼多多/京东）销售，无独立官网。"
                 "产品图抓取方式：通过淘宝手动搜索后用浏览器截图上传。",
        "status": "NO_WEBSITE",
    },

    "jiufengwang": {
        "brand_id": 12,
        "website": None,
        "products_url": None,
        "img_pattern": "该品牌无独立官网，产品图来源：淘宝/拼多多搜索'九凤王桨板'",
        "notes": "九凤王主要在国内电商平台销售，无独立官网。"
                 "产品图抓取方式：通过淘宝手动搜索后用浏览器截图上传。",
        "status": "NO_WEBSITE",
    },

    "decathlon": {
        "brand_id": 7,
        "website": "https://www.decathlon.com.cn",
        "products_url": "https://www.decathlon.com.cn/zh/browse/c0-sports/c1-kayak-stand-up-paddle/c2-stand-up-paddle-accessories/",
        "referer": "https://www.decathlon.com.cn/",
        "img_base": "https://contents.mediadecathlon.com/",
        "img_pattern": "迪卡侬中国站，JavaScript 渲染，WebFetch 可能返回空内容。"
                       "图片 CDN: contents.mediadecathlon.com，无防盗链。"
                       "全球站: https://www.decathlon.com/sports/sup-paddleboard/",
        "notes": "迪卡侬品牌名 ITIWIT（桨板产品线），官网为 JavaScript 渲染，直接 curl 获取不到商品列表。"
                 "最佳获取方式：①访问 decathlon.com（英文全球站）的 ITIWIT 产品页，图片无防盗链；"
                 "②从迪卡侬 APP 或小程序截取产品图",
        "products": {
            "ITIWIT X500 10'6\"": "https://www.decathlon.com.cn/zh/p/itiwit-x500-sup/_/R-p-340534",
            "ITIWIT X900 14'": "https://www.decathlon.com.cn/zh/p/itiwit-x900-sup-race/_/R-p-340536",
        },
        "status": "JS_RENDER",
    },
}

# ════════════════════════════════════════════════════════════════
# 工具函数
# ════════════════════════════════════════════════════════════════

BASE_URL = "https://sup.iaddu.cn"
ADMIN_PASSWORD = "sup_wiki_admin_2026"


def get_token() -> str:
    req = urllib.request.Request(
        f"{BASE_URL}/api/admin/login",
        data=json.dumps({"password": ADMIN_PASSWORD}).encode(),
        headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())["token"]


def upload_image_from_url(img_url: str, token: str, referer: str = None, folder: str = "products") -> str:
    """从 URL 下载图片（支持防盗链 Referer）并上传到 OSS"""
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    if referer:
        headers["Referer"] = referer
    if img_url.startswith("//"):
        img_url = "https:" + img_url

    try:
        req = urllib.request.Request(img_url, headers=headers)
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read()
        if len(data) < 5000:
            print(f"  ✗ 图片太小({len(data)}B)")
            return ""

        ext = img_url.split("?")[0].split(".")[-1].lower()
        if ext not in ("jpg", "jpeg", "png", "webp"): ext = "jpg"
        mime = {"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png","webp":"image/webp"}.get(ext,"image/jpeg")
        bd = "----SUPBnd"
        body = (
            f"--{bd}\r\nContent-Disposition: form-data; name=\"folder\"\r\n\r\n{folder}\r\n"
            f"--{bd}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"img.{ext}\"\r\nContent-Type: {mime}\r\n\r\n"
        ).encode() + data + f"\r\n--{bd}--\r\n".encode()
        ureq = urllib.request.Request(f"{BASE_URL}/api/admin/upload", data=body,
            headers={"Authorization": f"Bearer {token}",
                     "Content-Type": f"multipart/form-data; boundary={bd}"}, method="POST")
        with urllib.request.urlopen(ureq, timeout=30) as r:
            url = json.loads(r.read()).get("url", "")
            if url: print(f"  ✓ 上传成功 ({len(data)//1024}KB)")
            return url
    except Exception as e:
        print(f"  ✗ 错误: {e}")
        return ""


def upload_brand_images(brand_key: str, img_filenames: list, token: str, max_imgs: int = 3) -> list:
    """根据品牌配置批量上传图片（自动处理 Referer 和 img_base）"""
    cfg = BRAND_GUIDE.get(brand_key, {})
    referer = cfg.get("referer")
    img_base = cfg.get("img_base", "")
    oss_urls = []
    for fname in img_filenames[:max_imgs + 2]:
        if len(oss_urls) >= max_imgs: break
        url = img_base + fname if not fname.startswith("http") else fname
        oss = upload_image_from_url(url, token, referer=referer)
        if oss: oss_urls.append(oss)
        time.sleep(0.4)
    return oss_urls


def update_product(product_id: int, data: dict, token: str) -> bool:
    req = urllib.request.Request(
        f"{BASE_URL}/api/admin/products/{product_id}",
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="PUT"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read()).get("success", False)
    except Exception as e:
        print(f"  ✗ 更新失败: {e}")
        return False


def print_brand_guide(brand_key: str = None):
    """打印品牌官网导航指引"""
    brands = [brand_key] if brand_key else list(BRAND_GUIDE.keys())
    for key in brands:
        cfg = BRAND_GUIDE[key]
        status = cfg.get("status", "OK")
        icon = {"OK": "✅", "SSL_EXPIRED": "⚠️", "TLS_ISSUE": "⚠️", "NO_WEBSITE": "❌", "JS_RENDER": "🔧"}.get(status, "?")
        print(f"\n{icon} [{key}] (brand_id={cfg.get('brand_id','?')})")
        print(f"   官网: {cfg.get('website', '无')}")
        if cfg.get('products_url'):
            print(f"   产品列表: {cfg['products_url']}")
        print(f"   图片规律: {cfg.get('img_pattern','未知')}")
        print(f"   说明: {cfg.get('notes','')[:100]}")
        if cfg.get('products'):
            print(f"   已知产品页({len(cfg['products'])}个):")
            for name, url in cfg['products'].items():
                print(f"     - {name}: {url[:80]}")


# ════════════════════════════════════════════════════════════════
# 快速操作示例
# ════════════════════════════════════════════════════════════════

def example_chaoyang():
    """示例：用朝阳已知图片 ID 更新产品"""
    token = get_token()
    cfg = BRAND_GUIDE["chaoyang"]
    imgs = cfg["known_images"]["竞速板"]  # 已验证可用的图片文件名
    oss_urls = upload_brand_images("chaoyang", imgs, token)
    success = update_product(34, {"images": oss_urls}, token)
    print(f"朝阳竞速板: {'✅' if success else '✗'}, {len(oss_urls)} 张图")


def example_starboard_sprint():
    """示例：更新 Starboard Sprint 官方图"""
    token = get_token()
    imgs = [
        "2026-Starboard-SUP-Sprint-Inflatable-Deluxe-14-x-24_aa12a7a2-bdc8-4ea3-8ca4-39a601be6acd.jpg",
        "2026-Starboard-SUP-All-Star-Inflatable-Deluxe-14-x-24.5_8918bd73-33ea-4481-8150-ba089f5c6cf2.jpg",
    ]
    oss_urls = upload_brand_images("starboard", imgs, token)
    success = update_product(5, {"images": oss_urls}, token)
    print(f"Starboard Sprint: {'✅' if success else '✗'}, {len(oss_urls)} 张图")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "guide":
        brand = sys.argv[2] if len(sys.argv) > 2 else None
        print_brand_guide(brand)
    else:
        print("SUP Wiki 品牌图片抓取工具")
        print()
        print("查看所有品牌官网导航：")
        print("  python3 scripts/fetch_brand_products.py guide")
        print()
        print("查看指定品牌：")
        print("  python3 scripts/fetch_brand_products.py guide starboard")
        print()
        print("品牌 KEY 列表:")
        for k, v in BRAND_GUIDE.items():
            status = v.get("status", "OK")
            icon = {"OK":"✅","SSL_EXPIRED":"⚠️","TLS_ISSUE":"⚠️","NO_WEBSITE":"❌","JS_RENDER":"🔧"}.get(status,"?")
            print(f"  {icon} {k} (brand_id={v.get('brand_id','?')})")
