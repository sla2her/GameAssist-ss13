"""Собирает robo/mod-data.js — данные МОД-костюмов BlueMoon для симулятора сборки в Робототехнике.

Запуск: python robo/build_mod.py <корень BlueMoon-Station>
Берёт модули (code/modules/mod/modules), темы обшивки, броню, рецепты мехфаба, узлы исследований,
батареи и листы спрайтов .dmi. Описания механики способностей модулей — в самой странице (robo/mod.js).
"""
import base64, glob, json, os, re, struct, sys, zlib

ROOT = sys.argv[1] if len(sys.argv) > 1 else r'D:\Git\BlueMoon-Station'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'mod-data.js')
P = lambda *a: os.path.join(ROOT, *a)


def read(p):
    return open(p, encoding='utf-8-sig').read()


def strip_comments(s):
    out, q = [], False
    i = 0
    while i < len(s):
        c = s[i]
        if c == '"' and (i == 0 or s[i - 1] != '\\'):
            q = not q
        if not q and s.startswith('//', i):
            j = s.find('\n', i)
            if j < 0:
                break
            i = j
            continue
        out.append(c)
        i += 1
    return ''.join(out)


def blocks(text):
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
        while (v.count('(') > v.count(')') or v.rstrip().endswith('\\')) and i + 1 < len(body):
            i += 1
            v = v.rstrip().rstrip('\\') + '\n' + body[i]
        out[k] = strip_comments(v).strip()
        i += 1
    return out


def plist(v):
    v = strip_comments(v or '').strip()
    if not v.startswith('list('):
        return []
    inner = v[5:v.rfind(')')]
    items, depth, cur, q = [], 0, '', False
    for ch in inner:
        if ch == '"':
            q = not q
        if not q:
            depth += (ch == '(') - (ch == ')')
        if ch == ',' and depth == 0 and not q:
            items.append(cur.strip())
            cur = ''
        else:
            cur += ch
    if cur.strip():
        items.append(cur.strip())
    return items


def unq(s):
    s = (s or '').strip()
    if len(s) > 1 and s[0] == s[-1] == '"':
        s = s[1:-1]
    s = re.sub(r'\\\s*\n\s*', '', s)
    s = s.replace('\\improper ', '').replace('\\n', ' ').replace('\\"', '"')
    return re.sub(r'\s+', ' ', s).strip()


DEF = {'DEFAULT_CHARGE_DRAIN': 2, 'CIVILIAN_LOW_CHARGE_DRAIN': 1, 'VERY_HIGHT_CHARGE_DRAIN': 6, 'DEBUG_LOW_CHARGE_DRAIN': 0.5,
       'DEFAULT_MAX_COMPLEXITY': 15, 'STATION_COMBAT_MAX_COMPLEXITY': 13, 'COMMAND_MAX_COMPLEXITY': 20, 'ANTAG_MAX_COMPLEXITY': 20,
       'CENTCOM_MAX_COMPLEXITY': 15, 'DEBUG_COMPLEXITY': 50, 'ADMINISTRATIVE_MAX_COMPLEXITY': 1000, 'LOADER_MAX_COMPLEXITY': 10,
       'ELITE_MAX_COMPLEXITY': 19, 'CENTCOM_COMBAT_MAX_COMPLEXITY': 25, 'MODULE_PASSIVE': 0, 'MODULE_USABLE': 1,
       'MODULE_TOGGLE': 2, 'MODULE_ACTIVE': 3, 'MODULE_ARMOR': 4, 'TRUE': 1, 'FALSE': 0, 'NONE': 0,
       'MOD_PART_HEAD': 1, 'MOD_PART_CHEST': 2, 'MOD_PART_GLOVES': 3, 'MOD_PART_FEET': 4,
       'STANDARD_CELL_CHARGE': 1000, 'SHEET_MATERIAL_AMOUNT': 2000, 'MINERAL_MATERIAL_AMOUNT': 2000}


def num(v):
    e = strip_comments(v or '').strip()
    if not e:
        return None
    for k in sorted(DEF, key=len, reverse=True):
        e = re.sub(r'\b' + k + r'\b', str(DEF[k]), e)
    e = re.sub(r'(\d+(?:\.\d+)?)\s*SECONDS', r'(\1*10)', e)
    e = re.sub(r'(\d+(?:\.\d+)?)\s*MINUTES', r'(\1*600)', e)
    e = re.sub(r'(\d+(?:\.\d+)?)\s*KILO\s*WATTS?', r'(\1*1000)', e)
    if re.fullmatch(r'[\d.\s+\-*/()e]+', e):
        try:
            return eval(e)
        except Exception:
            return None
    return None


def collect(pattern, prefix):
    raw = {}
    for f in glob.glob(pattern, recursive=True):
        for path, body in blocks(read(f)):
            if path.startswith(prefix) and '/proc/' not in path and '/verb/' not in path:
                d = raw.setdefault(path, {})
                d.update(parse_vars(body))
                d.setdefault('_file', os.path.basename(f).replace('.dm', ''))
    return raw


def resolver(raw, root, base):
    cache = {}

    def res(p):
        if p in cache:
            return cache[p]
        par = raw.get(p, {}).get('parent_type') or (p.rsplit('/', 1)[0] if p != root else None)
        r = dict(res(par)) if par and par.startswith(root) else dict(base)
        for k, v in raw.get(p, {}).items():
            if k != '_file':
                r[k] = v
        r['_file'] = raw.get(p, {}).get('_file', r.get('_file'))
        cache[p] = r
        return r
    return res


# ---------- модули ----------
MODROOT = '/obj/item/mod/module'
mraw = collect(P('code', 'modules', 'mod', '**', '*.dm'), MODROOT)
MBASE = {'name': '"MOD module"', 'complexity': '0', 'module_type': 'MODULE_PASSIVE', 'idle_power_cost': '0',
         'active_power_cost': '0', 'use_power_cost': '0', 'cooldown_time': '0', 'removable': 'TRUE',
         'icon': "'icons/obj/clothing/modsuit/mod_modules.dmi'", 'icon_state': '"module"'}
mres = resolver(mraw, MODROOT, MBASE)

# ---------- рецепты и узлы ----------
designs = {}
for path, body in blocks(read(P('code', 'modules', 'research', 'designs', 'mod_designs.dm'))):
    if not path.startswith('/datum/design'):
        continue
    designs[path] = parse_vars(body)


def dres(p):
    par = p.rsplit('/', 1)[0]
    r = dict(dres(par)) if par in designs else {}
    r.update(designs.get(p, {}))
    return r


MATS = {'iron': 'металл', 'glass': 'стекло', 'plasma': 'плазма', 'gold': 'золото', 'silver': 'серебро', 'uranium': 'уран',
        'titanium': 'титан', 'diamond': 'алмазы', 'bluespace': 'БС-кристаллы', 'plastic': 'пластик', 'bananium': 'бананиум',
        'plastitanium': 'пластитан'}
by_build, by_id = {}, {}
for p in designs:
    d = dres(p)
    bp = d.get('build_path', '').strip()
    did = unq(d.get('id', ''))
    if not bp or not did:
        continue
    mats = {}
    for it in plist(d.get('materials', '')):
        kv = re.match(r'/datum/material/(\w+)\s*=\s*(.+)', it)
        if kv:
            mats[MATS.get(kv.group(1), kv.group(1))] = round((num(kv.group(2)) or 0) / 2000, 2)
    entry = {'id': did, 'name': unq(d.get('name', '')), 'mats': mats, 'time': (num(d.get('construction_time', '')) or 0) / 10,
             'type': d.get('build_type', '')}
    by_build[bp] = entry
    by_id[did] = entry

nodes = {}
for path, body in blocks(read(P('code', 'modules', 'research', 'techweb', 'nodes', 'mod_nodes.dm'))):
    v = parse_vars(body)
    if 'id' not in v:
        continue
    nid = unq(v['id'])
    cost = 0
    m = re.search(r'=\s*(\d+)', v.get('research_costs', ''))
    if m:
        cost = int(m.group(1))
    nodes[nid] = {'name': unq(v.get('display_name', '')), 'desc': unq(v.get('description', '')), 'cost': cost,
                  'start': v.get('starting_node', '') == 'TRUE',
                  'pre': [unq(x) for x in plist(v.get('prereq_ids', ''))],
                  'designs': [unq(x) for x in plist(v.get('design_ids', ''))]}
design_node = {d: nid for nid, n in nodes.items() for d in n['designs']}

modules = {}
for path in sorted(mraw):
    r = mres(path)
    name = unq(r.get('name'))
    if not name or name in ('MOD module',) or path == MODROOT:
        continue
    mid = path.replace(MODROOT + '/', '')
    des = by_build.get(path)
    inc = [x.strip().replace(MODROOT + '/', '') for x in plist(r.get('incompatible_modules', '')) if x.strip().startswith('/')]
    modules[mid] = {
        'name': name,
        'desc': unq(r.get('desc', '')),
        'cx': num(r.get('complexity')) or 0,
        'type': int(num(r.get('module_type')) or 0),
        'idle': num(r.get('idle_power_cost')) or 0,
        'act': num(r.get('active_power_cost')) or 0,
        'use': num(r.get('use_power_cost')) or 0,
        'cd': (num(r.get('cooldown_time')) or 0) / 10,
        'inc': inc,
        'rm': r.get('removable', 'TRUE') != 'FALSE',
        'sheet': r.get('icon', '').strip("'").split('/')[-1],
        'state': unq(r.get('icon_state', '')),
        'file': r.get('_file', ''),
        'part': int(num(r.get('required_modpart_index')) or 0),
        'mincell': num(r.get('minimum_cell_charge')) or 0,
        'full': r.get('need_full_deploy', '') == 'TRUE',
        'device': r.get('device', '').strip() or None,
    }
    if r.get('armor_module_type'):
        modules[mid]['armor'] = r['armor_module_type'].strip()
    if des:
        modules[mid]['design'] = {'mats': des['mats'], 'time': des['time'], 'node': design_node.get(des['id']), 'id': des['id']}

# ---------- темы ----------
THROOT = '/datum/mod_theme'
traw = collect(P('code', 'modules', 'mod', 'mod_customizing', 'mod_themes', '*.dm'), THROOT)
TBASE = {'complexity_max': 'DEFAULT_MAX_COMPLEXITY', 'cell_drain': 'DEFAULT_CHARGE_DRAIN', 'slowdown_inactive': '0',
         'slowdown_active': '0', 'max_armor_module_count': '2', 'compatible_with_armor_modules': 'TRUE', 'allow_hot_swap': 'FALSE',
         'siemens_coefficient': '0.5', 'resistance_flags': 'NONE', 'brc_mitigation_bonus': '0'}
tres = resolver(traw, THROOT, TBASE)

# броня
araw = collect(P('code', '__BLUEMOONCODE', '_DEFINES', '_datum_armors', '**', '*.dm'), '/datum/armor')
ARMOR_KEYS = ['melee', 'bullet', 'laser', 'energy', 'bomb', 'bio', 'rad', 'fire', 'acid', 'magic', 'wound']


def armor(p, depth=0):
    v = araw.get(p, {})
    base = armor(v['base_armor_type'].strip(), depth + 1) if v.get('base_armor_type') and depth < 6 else {k: 0 for k in ARMOR_KEYS}
    base = dict(base)
    for k in ARMOR_KEYS:
        if k in v:
            base[k] = num(v[k]) or 0
    return base


# обшивки: construction/armor -> тема
craw = collect(P('code', 'modules', 'mod', 'mod_construction.dm'), '/obj/item/mod/construction/armor')
plating_theme = {}
for p, v in craw.items():
    t = v.get('theme') or ('/datum/mod_theme' if p == '/obj/item/mod/construction/armor' else None)
    if t:
        plating_theme[p] = t.strip()

themes = {}
for path in sorted(traw):
    r = tres(path)
    if not r.get('name'):
        continue
    tid = path.replace(THROOT, '').strip('/') or 'standard'
    plating = next((pp for pp, t in plating_theme.items() if t == path), None)
    des = by_build.get(plating) if plating else None
    themes[tid] = {
        'name': unq(r['name']),
        'desc': unq(r.get('desc', '')),
        'ext': unq(r.get('extended_desc', '')),
        'cx': num(r['complexity_max']) or 15,
        'drain': num(r['cell_drain']) or 0,
        'slow_on': num(r['slowdown_active']) or 0,
        'slow_off': num(r['slowdown_inactive']) or 0,
        'armor': armor(r.get('armor_type', '/datum/armor/modsuit_standard').strip()),
        'armslots': int(num(r['max_armor_module_count']) or 0),
        'armorok': r['compatible_with_armor_modules'] != 'FALSE',
        'hotswap': r['allow_hot_swap'] == 'TRUE',
        'siemens': num(r['siemens_coefficient']),
        'fireproof': 'FIRE_PROOF' in r['resistance_flags'],
        'acidproof': 'ACID_PROOF' in r['resistance_flags'],
        'brc': num(r['brc_mitigation_bonus']) or 0,
        'skin': unq(r.get('default_skin', 'standard')),
        'inbuilt': [x.strip().replace(MODROOT + '/', '') for x in plist(r.get('inbuilt_modules', '')) if x.strip().startswith('/')],
        'black': [x.strip().replace(MODROOT + '/', '') for x in plist(r.get('module_blacklist', '')) if x.strip().startswith('/')],
        'plating': bool(plating),
    }
    if des:
        themes[tid]['design'] = {'mats': des['mats'], 'time': des['time'], 'node': design_node.get(des['id'])}

# ---------- батареи ----------
cells = []
for path, body in blocks(read(P('code', 'modules', 'power', 'cell.dm'))):
    if not path.startswith('/obj/item/stock_parts/cell'):
        continue
    v = parse_vars(body)
    mc = num(v.get('maxcharge'))
    if mc and v.get('name'):
        cells.append({'path': path.replace('/obj/item/stock_parts/cell', '') or '/', 'name': unq(v['name']), 'max': mc})

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
            if cur[0] not in states:
                states[cur[0]] = [idx, 1, 1]
        elif cur and line.startswith('dirs'):
            cur[1] = int(line.split('=')[1]); states[cur[0]][1] = cur[1]
        elif cur and line.startswith('frames'):
            cur[2] = int(line.split('=')[1]); states[cur[0]][2] = cur[2]
    return {'fw': fw, 'fh': fh, 'cols': w // fw, 'states': states,
            'png': 'data:image/png;base64,' + base64.b64encode(data).decode()}


sheets = {
    'mod_modules.dmi': dmi(P('icons', 'obj', 'clothing', 'modsuit', 'mod_modules.dmi')),
    'mod_modules_whitemoon.dmi': dmi(P('icons', 'obj', 'clothing', 'modsuit', 'mod_modules_whitemoon.dmi')),
    'mod_clothing.dmi': dmi(P('modular_bluemoon', 'icons', 'obj', 'clothing', 'modsuit', 'mod_clothing.dmi')),
    'mod_construction.dmi': dmi(P('modular_bluemoon', 'icons', 'obj', 'clothing', 'modsuit', 'mod_construction.dmi')),
}

data = {'modules': modules, 'themes': themes, 'nodes': nodes, 'cells': cells,
        'chassis': {k: by_id[k] for k in ('mod_shell', 'mod_helmet', 'mod_chestplate', 'mod_gauntlets', 'mod_boots', 'mod_plating_standard') if k in by_id},
        'sheets': sheets}
with open(OUT, 'w', encoding='utf-8') as fp:
    fp.write('// Сгенерировано robo/build_mod.py из code/modules/mod BlueMoon. Руками не править.\n')
    fp.write('window.MOD_DATA = ')
    json.dump(data, fp, ensure_ascii=False, separators=(',', ':'))
    fp.write(';\n')
print(f'{len(modules)} модулей ({sum(1 for m in modules.values() if "design" in m)} в мехфабе), {len(themes)} тем, '
      f'{len(nodes)} узлов, {len(cells)} батарей, {os.path.getsize(OUT) // 1024} КБ')
