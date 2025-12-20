import os
import datetime

# 設定：あなたのサイトのドメイン（まだなければ仮でOK）
BASE_URL = "https://laruvisona.co.jp"
OUTPUT_FILE = "../sitemap.xml" # 1つ上の階層に出力

def generate_sitemap():
    # スキャン対象のファイル
    files = ["index.html", "privacy.html"]
    
    sitemap_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    sitemap_content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    
    current_date = datetime.date.today().isoformat()
    
    for file in files:
        # index.html はルートURLにする
        if file == "index.html":
            url = BASE_URL + "/"
            priority = "1.0"
        else:
            url = BASE_URL + "/" + file
            priority = "0.8"
            
        sitemap_content += '  <url>\n'
        sitemap_content += f'    <loc>{url}</loc>\n'
        sitemap_content += f'    <lastmod>{current_date}</lastmod>\n'
        sitemap_content += '    <changefreq>monthly</changefreq>\n'
        sitemap_content += f'    <priority>{priority}</priority>\n'
        sitemap_content += '  </url>\n'
        
    sitemap_content += '</urlset>'
    
    # ファイル書き込み
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(sitemap_content)
    
    print(f"✅ サイトマップを生成しました: {os.path.abspath(OUTPUT_FILE)}")

if __name__ == "__main__":
    generate_sitemap()