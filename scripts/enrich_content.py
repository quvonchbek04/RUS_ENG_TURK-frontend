#!/usr/bin/env python3
"""
Kursni boyitish skripti (faqat ingliz tili kursi uchun).

Nima qiladi:
  data-src/content.original.json  — asl kurs kontenti
  data-src/words_en.json          — 2161 ta so'z (24 bo'lim) + gap + gap tarjimasi
  data-src/phrases_en.json        — 297 ta ibora (20 bo'lim) + gap + gap tarjimasi
  data-src/lesson_extras_en.json  — har bir dars uchun qo'shimcha dialog, grammatika, o'qish matni
        ↓
  frontend/public/content.json    — har bir ingliz tili darsiga `words`, `phrases`,
                                    `dialog2`, `grammar.more`, `reading` maydonlari qo'shilgan holda.

Har bir so'z/ibora aynan BITTA darsga biriktiriladi (takror yo'q). Skript oxirida
tekshiruv bajaradi: hamma element taqsimlanganmi, takror yo'qmi.

Ishga tushirish:   python3 scripts/enrich_content.py
"""
import json
import os
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data-src')
OUT = os.path.join(ROOT, 'frontend', 'public', 'content.json')


def rng(*parts):
    """rng(1, (5, 9)) -> [1, 5, 6, 7, 8, 9]  (1-asosli tartib raqamlari)"""
    res = []
    for p in parts:
        if isinstance(p, tuple):
            res.extend(range(p[0], p[1] + 1))
        else:
            res.append(p)
    return res


# ---------------------------------------------------------------------------
# SO'ZLAR: bo'lim raqami (1..24) -> {dars_id: [tartib raqamlari]}
# Tartib raqami — o'sha bo'limdagi (takrorlar olib tashlangandan keyingi) o'rni.
# "REST" — qolgan hamma elementlar (alohida tarqatiladi).
# ---------------------------------------------------------------------------
WORD_ALLOC = {
    # 1. Eng muhim fe'llar (293 ta: 'manage to', 'sit down' olib tashlangan)
    1: {'m2': rng((1, 55)), 'm4': rng((56, 110)), 'guide-a1': rng((111, 170)),
        'guide-a2': rng((171, 210)), 'm10': rng((211, 240)), 'm11': rng((241, 270)),
        'guide-b1': rng((271, 294))},
    # 2. Odamlar va oila (67)
    2: {'m17': rng((1, 23)), 'm1': rng((24, 67))},
    # 3. Tana va salomatlik (58 -> 'disease' olib tashlangan: 57)
    3: {'m13': 'ALL'},
    # 4. Uy va jihozlar (77)
    4: {'m17': rng((1, 55)), 'm20': rng((56, 77))},
    # 5. Ovqat va ichimlik (80 -> 'dish' olib tashlangan: 79)
    5: {'m19': 'ALL'},
    # 6. Kiyim-kechak (33)
    6: {'m24': 'ALL'},
    # 7. Joylar va shahar (58)
    7: {'m22': 'ALL'},
    # 8. Transport (34)
    8: {'m14': 'ALL'},
    # 9. Tabiat va ob-havo (65)
    9: {'m21': rng((1, 35)), 'm26': rng((36, 65))},
    # 10. Sifatlar (156)
    10: {'m18': rng((1, 40)), 'm5': rng((41, 100)), 'm10': rng((101, 130)), 'guide-b1': rng((131, 156))},
    # 11. Ranglar va shakllar (19)
    11: {'m18': 'ALL'},
    # 12. Raqamlar va miqdor (60)
    12: {'m3': 'ALL'},
    # 13. Vaqt (74)
    13: {'m20': 'ALL'},
    # 14. O'qish va ta'lim (60)
    14: {'m25': 'ALL'},
    # 15. Ish va pul (56)
    15: {'m8': rng((1, 30)), 'm16': rng((31, 56))},
    # 16. Texnologiya va media (37)
    16: {'m15': rng((1, 12), (23, 37)), 'm27': rng((13, 22))},
    # 17. Hissiyotlar va sifatlar (ot) (43)
    17: {'m9': rng((1, 16)), 'm11': rng((17, 27)), 'm28': rng((28, 33)), 'm12': rng((34, 43))},
    # 18. Bog'lovchi va kichik so'zlar (148)
    18: {'m3': rng((1, 2), (23, 55)), 'm7': rng((3, 22)), 'm0': rng((56, 62), (141, 148)),
         'm1': rng((63, 76)), 'm6': rng((77, 115)), 'm5': rng((116, 140))},
    # 19. Hobbi va bo'sh vaqt (51)
    19: {'m23': 'ALL'},
    # 20. Shahar hayoti va xizmatlar (41 -> 'delivery man', 'post' olib tashlangan: 39)
    20: {'m22': 'BY_WORD', 'm8': 'BY_WORD', 'm13': 'BY_WORD'},
    # 21. Fikrlash va muloqot (47)
    21: {'m11': rng((1, 23)), 'm9': rng((24, 47))},
    # 22. Fe'llar (qo'shimcha) (137 -> 'belong to' olib tashlangan: 136)
    22: {'m8': rng((1, 25)), 'm9': rng((26, 50)), 'm12': rng((51, 80)), 'guide-b2': rng((81, 136))},
    # 23. Sifatlar (qo'shimcha) (206 -> 'ill' olib tashlangan: 205)
    23: {'guide-a2': rng((1, 40)), 'm10': rng((41, 90)), 'guide-b1': rng((91, 140)), 'guide-b2': rng((141, 205))},
    # 24. Otlar (qo'shimcha) (268 -> 'error' emas; 'harbor' olib tashlangan: 267) — mavzuli to'plamlar + qoldiq
    24: 'THEMED',
}

# 20-bo'lim (xizmatlar) so'z bo'yicha taqsimot
SERVICES_BY_WORD = {
    'm8': ['form', 'queue', 'ID card', 'fee', 'fine', 'permit', 'insurance'],
    'm13': ['emergency', 'ambulance', 'danger', 'safety'],
    # qolganlari -> m22
}

# 24-bo'lim (otlar) mavzuli to'plamlar
NOUN_THEMES = {
    'm15': 'device cable code machine equipment instrument tool system method process structure version unit formula alarm'.split(),
    'm26': 'climate environment pollution resource harvest crop landscape cave breeze flame smoke grain horizon population damage'.split(),
    'm27': 'article author journal audience chart survey claim source content context draft record image reception background frame'.split(),
    'm28': ('poem poet drama architecture plot scene rhythm inspiration passion beauty symbol theme palace heritage glory '
            'exhibition applause gesture ceremony anniversary fame kingdom empire era fabric pattern').split(),
    'm25': ('lecture research theory experiment discovery pupil ability effort challenge difficulty instance phrase term level '
            'proof exception').split(),
    'm13': 'breath nerve remedy hunger balance comfort condition shock tension birth death welfare'.split(),
    'm14': 'junction route path frontier boundary gate entrance slope ladder pace zone'.split(),
    'm16': ('award champion victory reputation honor mission outcome strategy priority responsibility role procedure benefit '
            'advantage disadvantage').split(),
    'm8': 'policy principle agency department majority minority nation state region property command demand military army'.split(),
    'm11': 'debate conflict quarrel threat violence battle weapon consequence crisis burden barrier witness trap odds'.split(),
    'm9': ('detail difference moment occasion situation appearance impact intention mess shame pride courage silence shadow '
           'darkness spirit sense feature gap').split(),
}
# Qoldiq otlar shu darslar orasida alifbo tartibida teng taqsimlanadi
NOUN_REST_ORDER = ['guide-a1', 'guide-a2', 'm10', 'm12', 'guide-b1', 'guide-b2']

WORD_REMOVE = {'belong to', 'sit down', 'manage to', 'delivery man', 'post', 'harbor', 'ill', 'error', 'disease', 'dish'}

# ---------------------------------------------------------------------------
# IBORALAR: bo'lim raqami (1..20) -> {dars_id: [tartib raqamlari]}
# ---------------------------------------------------------------------------
PHR_ALLOC = {
    1: {'m0': rng((1, 9)), 'guide-a1': rng((10, 15))},
    2: {'m4': 'ALL'},
    3: {'m1': 'ALL'},
    4: {'m11': rng((1, 8)), 'm7': rng((9, 12)), 'guide-b1': rng((13, 15))},
    5: {'m3': rng((1, 10)), 'guide-a1': rng((11, 15))},
    6: {'m2': 'ALL'},          # 'Can you give me a hand?' olib tashlangan -> 14 ta
    7: {'m5': rng((1, 10)), 'guide-a2': rng((11, 15))},
    8: {'m20': 'ALL'},
    9: {'m19': 'ALL'},
    10: {'m18': rng((1, 5)), 'm24': rng((6, 15))},
    11: {'m22': rng(1, 2, 3, 7, 8), 'm6': rng(4, 5, 6, 14, 15), 'm14': rng((9, 13))},
    12: {'m15': rng((1, 8)), 'm27': rng((9, 15))},
    13: {'m8': rng((1, 5)), 'm16': rng((6, 13)), 'm25': rng((14, 15))},
    14: {'m9': rng((1, 8)), 'm28': rng((9, 15))},
    15: {'m13': 'ALL'},
    16: {'m21': rng((1, 10)), 'm26': rng((11, 15))},
    17: {'m17': 'ALL'},
    18: {'m14': 'ALL'},
    19: {'m10': rng((1, 8)), 'm12': rng((9, 12)), 'guide-b2': rng((13, 15))},   # 'Honestly...' olib tashlangan -> 14 ta
    20: {'m8': rng((1, 10)), 'guide-b2': rng((11, 14))},                       # 'Under the weather' olib tashlangan -> 14 ta
}
PHR_REMOVE = {'Under the weather', 'Can you give me a hand?', 'Honestly...'}


def alloc_section(items, spec, label):
    """items: ro'yxat, spec: {dars: 'ALL' | indekslar} -> {dars: [items]} va tekshiruv."""
    n = len(items)
    out = defaultdict(list)
    used = set()
    for lesson, idxs in spec.items():
        if idxs == 'ALL':
            idxs = list(range(1, n + 1))
        for i in idxs:
            if i < 1 or i > n:
                # tartib raqami bo'lim hajmidan katta (olib tashlangan elementlar tufayli) — e'tiborsiz
                continue
            if i in used:
                raise SystemExit(f'{label}: {i}-element ikki marta taqsimlangan')
            used.add(i)
            out[lesson].append(items[i - 1])
    missing = [i for i in range(1, n + 1) if i not in used]
    if missing:
        raise SystemExit(f'{label}: taqsimlanmagan elementlar: {missing[:10]} ... ({len(missing)} ta)')
    return out


def main():
    content = json.load(open(os.path.join(SRC, 'content.original.json'), encoding='utf8'))
    words = json.load(open(os.path.join(SRC, 'words_en.json'), encoding='utf8'))
    phrases = json.load(open(os.path.join(SRC, 'phrases_en.json'), encoding='utf8'))
    extras = {}
    ex_path = os.path.join(SRC, 'lesson_extras_en.json')
    if os.path.exists(ex_path):
        extras = json.load(open(ex_path, encoding='utf8'))

    lesson_words = defaultdict(list)
    lesson_phr = defaultdict(list)
    dropped_words = []

    # --- so'zlar ---
    for si, sec in enumerate(words, start=1):
        rows = [r for r in sec['rows'] if r[0].lower() not in WORD_REMOVE]
        dropped_words += [r[0] for r in sec['rows'] if r[0].lower() in WORD_REMOVE]
        spec = WORD_ALLOC[si]
        if spec == 'THEMED':
            by_key = {r[0].lower(): r for r in rows}
            taken = set()
            for lesson, ws in NOUN_THEMES.items():
                for w in ws:
                    if w not in by_key:
                        raise SystemExit(f'Mavzuli ot topilmadi: {w}')
                    if w in taken:
                        raise SystemExit(f'Mavzuli ot takrorlangan: {w}')
                    taken.add(w)
                    lesson_words[lesson].append((si, by_key[w]))
            rest = [r for r in rows if r[0].lower() not in taken]
            k = len(NOUN_REST_ORDER)
            size = -(-len(rest) // k)
            for j, lesson in enumerate(NOUN_REST_ORDER):
                for r in rest[j * size:(j + 1) * size]:
                    lesson_words[lesson].append((si, r))
        elif si == 20:
            by_key = {r[0]: r for r in rows}
            taken = set()
            for lesson, ws in SERVICES_BY_WORD.items():
                for w in ws:
                    lesson_words[lesson].append((si, by_key[w]))
                    taken.add(w)
            for r in rows:
                if r[0] not in taken:
                    lesson_words['m22'].append((si, r))
        else:
            for lesson, rs in alloc_section(rows, spec, f'So\'z bo\'limi {si}').items():
                for r in rs:
                    lesson_words[lesson].append((si, r))

    # --- iboralar ---
    for pi, sec in enumerate(phrases, start=1):
        rows = [r for r in sec['rows'] if r[0] not in PHR_REMOVE]
        for lesson, rs in alloc_section(rows, PHR_ALLOC[pi], f'Ibora bo\'limi {pi}').items():
            for r in rs:
                lesson_phr[lesson].append((pi, r))

    # --- darslarga yozish ---
    total_w = total_p = 0
    seen_words = set()
    for group in content['DATA_EN']:
        for month in group['months']:
            lid = month['id']
            ws = lesson_words.get(lid, [])
            ps = lesson_phr.get(lid, [])
            month['words'] = [r for _, r in ws]
            month['phrases'] = [r for _, r in ps]
            for r in month['words']:
                k = r[0].lower()
                if k in seen_words:
                    raise SystemExit(f'Takror so\'z: {r[0]} ({lid})')
                seen_words.add(k)
            total_w += len(ws)
            total_p += len(ps)
            ex = extras.get(lid)
            if ex:
                if ex.get('dialog2'):
                    month['dialog2'] = ex['dialog2']
                if ex.get('grammarMore'):
                    month['grammar']['more'] = ex['grammarMore']
                if ex.get('reading'):
                    month['reading'] = ex['reading']
                if ex.get('tasks2'):
                    month['tasks'] = month['tasks'] + ex['tasks2']

    expected_w = sum(len([r for r in s['rows'] if r[0].lower() not in WORD_REMOVE]) for s in words)
    expected_p = sum(len([r for r in s['rows'] if r[0] not in PHR_REMOVE]) for s in phrases)
    assert total_w == expected_w, (total_w, expected_w)
    assert total_p == expected_p, (total_p, expected_p)

    # Darslarda bo'lmagan id'lar (xato tekshiruvi)
    ids = {m['id'] for g in content['DATA_EN'] for m in g['months']}
    for lid in list(lesson_words) + list(lesson_phr):
        if lid not in ids:
            raise SystemExit(f'Noma\'lum dars id: {lid}')

    json.dump(content, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    print(f'OK: {total_w} so\'z, {total_p} ibora darslarga biriktirildi. Olib tashlangan so\'zlar: {sorted(dropped_words)}')
    for g in content['DATA_EN']:
        for m in g['months']:
            print(f"  {m['id']:9s} {m['label']:22s} so'z={len(m['words']):3d} ibora={len(m['phrases']):2d}"
                  f"{' dialog2' if m.get('dialog2') else ''}{' more' if m['grammar'].get('more') else ''}{' reading' if m.get('reading') else ''}")


if __name__ == '__main__':
    sys.exit(main())
