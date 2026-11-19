# Extrae los textos en español que el servidor puede devolver en respuestas JSON.
# Uso: python scripts/i18n-handoff/server_strings.py > lista.json
import io
import json
import os
import re
import sys

ROOT = 'I:/Docentos'
EXCLUDE = re.compile(r'mailer|serverI18n|responseTranslations|logger|contractTexts|seo\.ts')
files = ['server.ts'] + ['server/' + f for f in sorted(os.listdir(ROOT + '/server')) if f.endswith('.ts')]
files = [f for f in files if not EXCLUDE.search(f)]

ES = re.compile(r"[áéíóúñ¿¡]|\b(el|la|los|las|de|del|no|un|una|para|con|se|al|en|es|ya|tu|su|debe|debes|pudo|curso|usuario|acceso|inv[aá]lid[oa])\b", re.I)
QUOTED = r"""'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`"""
LIT = re.compile(r"(?:\b(?:error|message|reason|detail)\s*:\s*|new\s+\w*Error\(\s*(?:\d+\s*,\s*)?)(?:" + QUOTED + ")")

out = {}
for f in files:
    src = io.open(ROOT + '/' + f, encoding='utf-8').read()
    for m in LIT.finditer(src):
        is_tpl = m.group(3) is not None
        text = m.group(1) if m.group(1) is not None else (m.group(2) if m.group(2) is not None else m.group(3))
        if not text or len(text) < 4:
            continue
        if is_tpl and '${' in text:
            continue
        if not ES.search(text):
            continue
        t = text.replace("\\'", "'").replace('\\"', '"')
        out.setdefault(t, f)

sys.stdout.reconfigure(encoding='utf-8')
print(json.dumps(out, ensure_ascii=False, indent=1))
