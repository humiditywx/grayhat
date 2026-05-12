import re
path1 = r'c:\Users\humid\Documents\GrayHat-Server\templates\index.html'
path2 = r'c:\Users\humid\Documents\GrayHat-Server\app\templates\index.html'

for path in [path1, path2]:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            text = f.read()

        text = re.sub(r'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><circle cx="12" cy="12" r="3"/>.*?</svg>', '<span class="material-icons-outlined">settings</span>', text, flags=re.DOTALL)

        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Fixed {path}")
    except Exception as e:
        print(f"Failed {path}: {e}")
