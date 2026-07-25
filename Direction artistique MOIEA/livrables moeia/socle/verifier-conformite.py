#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
moeïa — contrôle de conformité DA d'un fichier HTML d'outil.
Usage : python verifier-conformite.py ACT-moeia.html [AO-moeia.html ...]
Code retour 1 si au moins une ERREUR (les avertissements ne bloquent pas).
Réf. : moeia-direction-artistique.md
"""
import re, sys

# ---- Tokens autorisés (doc DA §2 + registres dérivés utilisés dans les configs) ----
TOKENS = {
    # neutres encre & pierre
    '221F1A','57534E','6E6961','8F8A82','F6F5F2','FBFAF8','FFFFFF','E5E2DC','EEECE7',
    'D8D3CB','3A362F','16130F',
    # cyan
    '04B7F9','0273C4','01599A','E9F6FD','C4E9FA','D3EEFB','7CD3FB','084468',
    # statuts
    '3E7A4E','EAF2EC','855900','F8F0DC','B3352B','F9EAE8',
    # déclinaisons des échelles warn/err/ok des configs
    'FBF6E8','F0E2B8','DDC386','C9A44E','A87F1C','6E4A00','5C3E00','4A3200','3D2900',
    'FBF0EE','F0CFCA','E2A69E','CE7268','932B23','7A241D','641E18','521812',
    'F3E5C3','E8D3A0','96700A',
    'D2E4D6','A6C7AE','6FA07B','2F5C3B','27492F','1F3A26',
    # séries graphiques
    '6B5CA5','A34E68',
    # divers légitimes
    '000000','FFF','000',
}
# Couleurs du module d'export Word (isolées, autorisées uniquement hors UI)
EXPORT_ALLOW = {'C00000','595959','1C1917','D9D9D9','F2F2F2','A6A6A6','404040','7F7F7F','BFBFBF',
                '1A1A1A','555','444'}
# Couleurs d'identité des sociétés du groupement (données configurables, pas des tokens UI)
SOCIETE_ALLOW = {'C46D3A','11A8A1','314464','378ADD','1D9E75','BA7517','11A8A1'}

ERR, WARN = [], []

def check(path):
    s = open(path, encoding='utf-8', errors='replace').read()
    err, warn = [], []

    # 1. Hex hors tokens
    for m in re.finditer(r'#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b', s):
        h = m.group(1).upper()
        if h in TOKENS: continue
        if h in EXPORT_ALLOW or h in SOCIETE_ALLOW:
            continue  # module export / données sociétés — hors scope tokens UI
        ctx = s[max(0, m.start()-60):m.end()+20].replace('\n', ' ')
        err.append(f"hex hors tokens #{h} … {ctx.strip()[:100]}")

    # 2. Dégradés interdits
    for pat, msg in [
        (r'bg-gradient-to-', 'classe bg-gradient-*'),
        (r'linear-gradient\((?![^)]*moeia)', 'linear-gradient CSS'),
    ]:
        n = len(re.findall(pat, s))
        if n: err.append(f"dégradé interdit ({msg}) × {n}")

    # 3. Registre IA : violet/purple/fuchsia ne doivent plus servir à de NOUVEAUX usages
    #    (les classes existantes sont remappées via config — avertissement seulement)
    n = len(re.findall(r'(?:bg|text|border|ring)-(?:purple|violet|fuchsia)-\d+', s))
    if n: warn.append(f"classes purple/violet/fuchsia héritées × {n} (remappées par config ; ne pas en ajouter)")

    # 4. Micro-typo sous le plancher (11px) hors couche de compensation
    n = len(re.findall(r'text-\[(?:[1-9]|10)px\]', s))
    if n: warn.append(f"tailles < 11px × {n} (compensées par moeia-layer ; ne pas en ajouter)")

    # 5. Couche moeïa et config remappé — requis pour les outils Tailwind uniquement
    if 'tailwindcss' in s:
        if 'id="moeia-layer"' not in s: err.append("couche <style id=\"moeia-layer\"> absente")
        if "'#221F1A'" not in s: err.append("tokens moeïa absents du tailwind.config (encre #221F1A introuvable)")
    else:
        if '#221F1A' not in s: err.append("tokens moeïa absents (encre #221F1A introuvable)")

    # 6. Fontes
    for f in ['Inter', 'Space+Grotesk', 'JetBrains+Mono']:
        if f not in s: err.append(f"fonte manquante dans le <head> : {f}")

    # 7. Tutoiement UI (heuristique — exclut les prompts IA qui contiennent 'Tu es un expert')
    for m in re.finditer(r'(?<![a-zé])(ton|ta|tes) (CCTP|DPGF|projet|dossier|fichier|JSON|RC)\b', s):
        ctx = s[max(0,m.start()-80):m.start()]
        if 'Tu es' not in ctx and 'expert' not in ctx:
            warn.append(f"tutoiement possible : « {m.group(0)} »")

    return err, warn

rc = 0
for path in sys.argv[1:] or ['ACT-moeia.html', 'AO-moeia.html']:
    try:
        err, warn = check(path)
    except FileNotFoundError:
        print(f"✗ {path} : introuvable"); rc = 1; continue
    print(f"\n=== {path} ===")
    for e in err:  print(f"  ERREUR  {e}")
    for w in warn: print(f"  avert.  {w}")
    if not err and not warn: print("  conforme.")
    if err: rc = 1
print(f"\n{'NON CONFORME' if rc else 'OK'}")
sys.exit(rc)
