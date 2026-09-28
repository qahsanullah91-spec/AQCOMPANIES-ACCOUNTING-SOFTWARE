import urllib.request
import re

def inspect():
    url = "http://localhost:3002/receivables"
    with urllib.request.urlopen(url) as res:
        html = res.read().decode("utf-8", errors="ignore")

    print(f"Total HTML length: {len(html)} bytes")
    
    # Find all link tags
    links = re.findall(r'<link[^>]+>', html)
    print("\n--- LINK TAGS ---")
    for l in links:
        print("  ", l)
        
    css_files = re.findall(r'href="([^"]+\.css)"', html)
    print("\n--- CSS HREF TARGETS ---")
    for c in css_files:
        print("  ", c)
        full_url = f"http://localhost:3002{c}" if c.startswith("/") else c
        try:
            with urllib.request.urlopen(full_url) as cres:
                data = cres.read()
                print(f"    [FETCH OK] {cres.status} | Content-Type: {cres.headers.get('content-type')} | Size: {len(data)} bytes")
        except Exception as e:
            print(f"    [FETCH FAIL] {full_url} -> {e}")

    # Inspect the first 1000 characters of HTML body
    body_match = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
    if body_match:
        print("\n--- BODY PREVIEW (FIRST 1500 CHARS) ---")
        print(body_match.group(1)[:1500])
    else:
        print("\n--- HTML PREVIEW (FIRST 1500 CHARS) ---")
        print(html[:1500])

if __name__ == "__main__":
    inspect()
