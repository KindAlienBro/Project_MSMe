import os
import re

DIR = r"c:\Users\kinda\OneDrive\Desktop\Vorniity\Project MSMe\frontend\src"

def process_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    orig = content
    content = re.sub(r'\bbg-white\b', 'bg-card', content)
    content = re.sub(r'\bbg-gray-50\b', 'bg-muted text-muted-foreground', content)
    content = re.sub(r'\border-gray-[12]00\b', 'border-border', content)
    content = re.sub(r'\btext-gray-[89]00\b', 'text-foreground', content)
    content = re.sub(r'\btext-gray-[56]00\b', 'text-muted-foreground', content)
    content = re.sub(r'\bbg-\[var\(--color-background\)\]\b', 'bg-background', content)
    
    # Ensure text is readable on bg-card if not specified
    # Actually, bg-card should be accompanied by text-card-foreground, but text-foreground works fine.

    if content != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {path}")

for root, _, files in os.walk(DIR):
    for f in files:
        if f.endswith('.tsx'):
            process_file(os.path.join(root, f))
