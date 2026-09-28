import os
import re

frontend_src = "d:/SOFTWARES-APPS/AQ-COMPANIES-ACCOUNT-SOFTWARE/frontend/src"

patterns = [
    (re.compile(r'(\w+)\.toLocaleString\('), "unsafe .toLocaleString"),
    (re.compile(r'(\w+)\.toFixed\('), "unsafe .toFixed"),
    (re.compile(r'(\w+)\.split\('), "unsafe .split"),
    (re.compile(r'(\w+)\.toLowerCase\('), "unsafe .toLowerCase"),
    (re.compile(r'(\w+)\.reduce\('), "unsafe .reduce"),
]

safe_words = {"new", "String", "Date", "Object", "Array", "Math", "Intl", "JSON", "encodeURIComponent"}

findings = []

for root, dirs, files in os.walk(frontend_src):
    for f in files:
        if f.endswith((".tsx", ".ts")):
            filepath = os.path.join(root, f)
            with open(filepath, "r", encoding="utf-8", errors="ignore") as fp:
                lines = fp.readlines()
                for idx, line in enumerate(lines, 1):
                    stripped = line.strip()
                    if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
                        continue
                    for pat, label in patterns:
                        for match in pat.finditer(line):
                            var_name = match.group(1)
                            if var_name in safe_words:
                                continue
                            span_start = match.start()
                            preceding = line[max(0, span_start - 2):span_start]
                            if "?." in preceding:
                                continue
                            findings.append((filepath, idx, label, var_name, line.strip()))

print(f"Total potential unsafe calls found: {len(findings)}")
by_type = {}
for fp, idx, label, var_name, line in findings:
    by_type.setdefault(label, []).append((fp, idx, var_name, line))

for label, items in by_type.items():
    print(f"\n--- {label} ({len(items)} instances) ---")
    for fp, idx, var_name, line in items[:20]:
        rel = os.path.relpath(fp, frontend_src)
        print(f"  {rel}:{idx} [{var_name}] -> {line[:90]}")
