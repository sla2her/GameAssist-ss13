"""Собирает fishing/data.js из модуля рыбалки BlueMoon (modular_bluemoon/fishing).

Запуск: python fishing/build_data.py <корень BlueMoon-Station>
Берёт типы рыб, места рыбалки (fish_source) и листы спрайтов (.dmi) и пишет window.FISH_DATA.
Механику (удочки, наживки, физику мини-игры) страница держит сама — она в коде почти не меняется.
"""
import base64, glob, json, os, re, struct, sys, zlib

ROOT = sys.argv[1] if len(sys.argv) > 1 else r'D:\Git\BlueMoon-Station'
MOD = os.path.join(ROOT, 'modular_bluemoon', 'fishing')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.js')


def read(p):
    return open(p, encoding='utf-8-sig').read()


def strip_comments(s):
    return re.sub(r'//[^\n]*', '', s)


def blocks(text):
    """(путь типа, строки тела) для объявлений верхнего уровня."""
    cur, body = None, []
    for line in text.splitlines():
        if line and not line[0].isspace() and not line.startswith(('//', '#')):
            if cur:
                yield cur, body
            m = re.match(r'^(/[\w/]+)\s*(?://.*)?$', line)
            cur, body = (m.group(1) if m else None), []
        elif cur is not None:
            body.append(line)
    if cur:
        yield cur, body


def parse_vars(body):
    out, i = {}, 0
    while i < len(body):
        line = body[i]
        m = re.match(r'^\t(?:var/(?:[\w/]+/)?)?(\w+)\s*=\s*(.*)$', line)
        if not m or line.startswith('\t\t'):
            i += 1
            continue
        k, v = m.group(1), m.group(2)
        depth = v.count('(') - v.count(')')
        while depth > 0 and i + 1 < len(body):
            i += 1
            v += '\n' + body[i]
            depth += body[i].count('(') - body[i].count(')')
        out[k] = v.strip() if '"' in v else strip_comments(v).strip()
        i += 1
    return out


def plist(v):
    v = strip_comments(v).strip()
    if not v.startswith('list('):
        return None
    inner = v[5:v.rfind(')')]
    items, depth, cur = [], 0, ''
    for ch in inner:
        depth += (ch == '(') - (ch == ')')
        if ch == ',' and depth == 0:
            items.append(cur.strip())
            cur = ''
        else:
            cur += ch
    if cur.strip():
        items.append(cur.strip())
    return items


def unq(s):
    s = s.strip()
    return s[1:-1] if len(s) > 1 and s[0] == s[-1] == '"' else s


DEFINES = {'MIN_AQUARIUM_TEMP': 273.15, 'MAX_AQUARIUM_TEMP': 373.15, 'T0C': 273.15, 'T20C': 293.15,
           'LAVALAND_MAX_TEMPERATURE': 2000, 'ICEBOX_MIN_TEMPERATURE': 100, 'TCMB': 2.7,
           'FISHING_DEFAULT_DIFFICULTY': 15, 'FISHING_EASY_DIFFICULTY': 10}


def temp_c(v):
    k = num(v)
    return None if k is None else round(k - 273.15)


def num(v):
    expr = strip_comments(v or '').strip()
    for k, val in DEFINES.items():
        expr = expr.replace(k, str(val))
    expr = re.sub(r'(\d+(?:\.\d+)?)\s*SECONDS', r'(\1*10)', expr)
    expr = re.sub(r'(\d+(?:\.\d+)?)\s*MINUTES', r'(\1*600)', expr)
    if expr and re.fullmatch(r'[\d.\s+\-*/()]+', expr):
        try:
            return eval(expr)
        except Exception:
            return None
    return None


# ---------- рыбы ----------
raw = {}
for f in glob.glob(os.path.join(MOD, 'code', 'fish', '**', '*.dm'), recursive=True):
    text = read(f)
    for path, body in blocks(text):
        if path.startswith('/obj/item/fish'):
            raw.setdefault(path, {}).update(parse_vars(body))
    # рыба, которую саму можно насадить как наживку
    for m in re.finditer(r'^(/obj/item/fish[\w/]*)/Initialize\(.*?\n((?:\t.*\n)+)', text, re.M):
        if 'TRAIT_FISHING_BAIT' in m.group(2):
            q = 'great' if 'GREAT_QUALITY' in m.group(2) else 'good' if 'GOOD_QUALITY' in m.group(2) else 'basic'
            raw.setdefault(m.group(1), {})['_bait'] = q

BASE = {
    'fish_movement_type': '/datum/fish_movement', 'fishing_difficulty_modifier': '0',
    'favorite_bait': 'list()', 'disliked_bait': 'list()', 'fish_traits': 'list()',
    'required_fluid_type': 'AQUARIUM_FLUID_FRESHWATER', 'average_size': '50', 'average_weight': '1000',
    'sprite_height': '3', 'max_integrity': '200', 'integrity_failure': '0.5', 'show_in_catalog': 'TRUE',
    'fish_flags': 'FISH_FLAG_SHOW_IN_CATALOG', 'icon': "'modular_bluemoon/fishing/icons/obj/aquarium/fish.dmi'",
    'required_temperature_min': 'MIN_AQUARIUM_TEMP', 'required_temperature_max': 'MAX_AQUARIUM_TEMP',
}


def parent_of(path):
    vs = raw.get(path, {})
    if 'parent_type' in vs:
        return vs['parent_type'].strip()
    p = path.rsplit('/', 1)[0]
    return p if p.startswith('/obj/item/fish') else None


def resolve(path, depth=0):
    par = parent_of(path) if path != '/obj/item/fish' else None
    base = resolve(par, depth + 1) if par and depth < 10 else dict(BASE)
    base.update({k: v for k, v in raw.get(path, {}).items() if not k.startswith('_')})
    return base


def resolve_refs(r, depth=0):
    for k, v in list(r.items()):
        m = re.fullmatch(r'\s*(/obj/item/fish[\w/]*)::(\w+)\s*', v)
        if m and depth < 5:
            r[k] = resolve_refs(resolve(m.group(1)), depth + 1).get(m.group(2), BASE.get(m.group(2), ''))
    return r


def bait_list(v):
    out = []
    for it in plist(v) or []:
        if it.startswith('list('):
            d = {}
            for s in plist(it):
                kv = re.match(r'"?(\w+)"?\s*=\s*(.+)', s.strip(), re.S)
                if kv:
                    d[unq(kv.group(1)).replace('FISH_BAIT_', '').title()] = unq(kv.group(2).strip())
            kind = d.get('Type', '').replace('FISH_BAIT_', '').lower()
            entry = {'k': kind, 'v': d.get('Value', '')}
            if d.get('Amount'):
                entry['n'] = num(d['Amount'])
            out.append(entry)
        elif it.startswith('/'):
            out.append({'k': 'path', 'v': it})
    return out


fish = {}
for path in sorted(raw):
    if path in ('/obj/item/fish', '/obj/item/fish/lcm') or '/proc' in path:
        continue
    r = resolve_refs(resolve(path))
    if not r.get('name'):
        continue
    flags = r.get('fish_flags', '')
    fid = path.replace('/obj/item/fish/', '')
    fish[fid] = {
        'en': unq(r['name']).replace('\\improper ', ''),
        'desc': unq(r.get('desc', '')),
        'sheet': r.get('icon', '').strip("'").split('/')[-1],
        'state': unq(strip_comments(r.get('icon_state', ''))),
        'move': r['fish_movement_type'].replace('/datum/fish_movement', '').strip('/') or 'default',
        'dm': num(r['fishing_difficulty_modifier']) or 0,
        'fav': bait_list(r['favorite_bait']),
        'bad': bait_list(r['disliked_bait']),
        'traits': [t.strip().replace('/datum/fish_trait/', '') for t in plist(r['fish_traits']) or []],
        'fluid': r['required_fluid_type'].replace('AQUARIUM_FLUID_', ''),
        'tmin': temp_c(r['required_temperature_min']),
        'tmax': temp_c(r['required_temperature_max']),
        'size': num(r['average_size']),
        'weight': num(r['average_weight']),
        'h': num(r['sprite_height']),
        'hp': num(r['max_integrity']) * (1 - num(r['integrity_failure'])),
        'catalog': '~FISH_FLAG_SHOW_IN_CATALOG' not in flags and r.get('show_in_catalog', 'TRUE') != 'FALSE',
    }
    if raw[path].get('_bait'):
        fish[fid]['bait'] = raw[path]['_bait']

# ---------- места рыбалки ----------
sources = {}
for f in glob.glob(os.path.join(MOD, 'code', '**', '*.dm'), recursive=True):
    for path, body in blocks(read(f)):
        if not path.startswith('/datum/fish_source') or '/proc' in path:
            continue
        s = sources.setdefault(path, {})
        for k, v in parse_vars(body).items():
            if k in ('fish_table', 'fish_counts', 'fish_count_regen'):
                items = plist(v)
                if items is None:
                    s[k] = None
                    continue
                tbl = []
                for it in items:
                    kv = re.match(r'([^=]+?)\s*=\s*(.+)$', it.strip(), re.S)
                    if kv:
                        key = kv.group(1).strip()
                        key = 'dud' if key == 'FISHING_DUD' else key.replace('/obj/item/fish/', 'fish:')
                        tbl.append([key, num(kv.group(2))])
                s[k] = tbl
            elif k == 'wait_time_range':
                s[k] = [num(x) for x in plist(v)]
            elif k in ('fishing_difficulty', 'unlock_requirement'):
                s[k] = num(v)
            elif k in ('background', 'catalog_description', 'radial_name'):
                s[k] = unq(v)


def resolve_src(p):
    par = p.rsplit('/', 1)[0]
    base = resolve_src(par) if par.startswith('/datum/fish_source') and par in sources else \
        {'fishing_difficulty': 15, 'background': 'background_default'}
    base = dict(base)
    base.update(sources.get(p, {}))
    return base


src_out = {}
for p in sources:
    r = resolve_src(p)
    if not r.get('fish_table') and p != '/datum/fish_source/portal/random':
        continue
    sid = p.replace('/datum/fish_source/', '') or 'base'
    src_out[sid] = {
        'diff': r.get('fishing_difficulty', 15),
        'bg': r.get('background', 'background_default'),
        'table': r.get('fish_table') or [],
        'counts': dict(r.get('fish_counts') or []),
        'regen': {k: v / 600 for k, v in (r.get('fish_count_regen') or [])},
        'unlock': r.get('unlock_requirement', 0),
        'name': r.get('catalog_description') or '',
    }
    if r.get('wait_time_range'):
        src_out[sid]['wait'] = [x / 10 for x in r['wait_time_range']]

# Случайный портал: все порталы, кроме синдикатского, вес каждого 1–4 (средний 2.5), без промаха
rnd = {}
for sid, s in src_out.items():
    if sid.startswith('portal') and sid not in ('portal/syndicate', 'portal/random'):
        for k, _ in s['table']:
            if k != 'dud':
                rnd[k] = 2.5
rnd['fish:holo/checkered'] = 2.5
if 'portal/random' in src_out:
    src_out['portal/random']['table'] = [[k, w] for k, w in rnd.items()]

# ---------- спрайты ----------
def dmi(path):
    data = open(path, 'rb').read()
    pos, desc, w = 8, '', 0
    while pos < len(data):
        ln, typ = struct.unpack('>I4s', data[pos:pos + 8])
        chunk = data[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            w = struct.unpack('>I', chunk[:4])[0]
        elif typ in (b'zTXt', b'tEXt'):
            key, rest = chunk.split(b'\0', 1)
            if key == b'Description':
                desc = (zlib.decompress(rest[1:]) if typ == b'zTXt' else rest).decode('utf-8')
        pos += 12 + ln
    fw = fh = 32
    states, idx, cur = {}, 0, None
    for line in desc.splitlines():
        line = line.strip()
        if line.startswith('width'):
            fw = int(line.split('=')[1])
        elif line.startswith('height'):
            fh = int(line.split('=')[1])
        elif line.startswith('state'):
            if cur:
                idx += cur[1] * cur[2]
            cur = [line.split('=', 1)[1].strip().strip('"'), 1, 1]
            states[cur[0]] = idx
        elif cur and line.startswith('dirs'):
            cur[1] = int(line.split('=')[1])
        elif cur and line.startswith('frames'):
            cur[2] = int(line.split('=')[1])
    return {'fw': fw, 'fh': fh, 'cols': w // fw, 'states': states,
            'png': 'data:image/png;base64,' + base64.b64encode(data).decode()}


ICONS = os.path.join(MOD, 'icons')
sheets = {
    'fish.dmi': dmi(os.path.join(ICONS, 'obj', 'aquarium', 'fish.dmi')),
    'rift.dmi': dmi(os.path.join(ICONS, 'obj', 'aquarium', 'rift.dmi')),
    'wide.dmi': dmi(os.path.join(ICONS, 'obj', 'aquarium', 'wide.dmi')),
    'fish_sprites.dmi': dmi(os.path.join(ICONS, 'fish_sprites.dmi')),
    'fishing.dmi': dmi(os.path.join(ICONS, 'obj', 'fishing.dmi')),
    'fishing_hud.dmi': dmi(os.path.join(ICONS, 'hud', 'fishing_hud.dmi')),
}

data = {'fish': fish, 'sources': src_out, 'sheets': sheets}
with open(OUT, 'w', encoding='utf-8') as fp:
    fp.write('// Сгенерировано fishing/build_data.py из modular_bluemoon/fishing BlueMoon. Руками не править.\n')
    fp.write('window.FISH_DATA = ')
    json.dump(data, fp, ensure_ascii=False, separators=(',', ':'))
    fp.write(';\n')
print(f'{len(fish)} рыб, {len(src_out)} мест, {os.path.getsize(OUT) // 1024} КБ -> {OUT}')
