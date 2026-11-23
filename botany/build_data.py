"""Собирает botany/data.js из кода BlueMoon-Station: растения, их статы, гены, реагенты и мутации.

Запуск: python botany/build_data.py <корень BlueMoon-Station>
Читает все .dm из tgstation.dme в порядке подключения (поздние определения перекрывают ранние, как в игре),
берёт типы /obj/item/seeds, продукты урожая, названия реагентов и черт, ассортимент MegaSeed
и листы спрайтов (.dmi). Механику лотка и действие химии на растения страница держит сама.
"""
import base64, json, os, re, struct, sys, zlib

ROOT = sys.argv[1] if len(sys.argv) > 1 else r'D:\Git\BlueMoon-Station'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.js')


def read(p):
    return open(p, encoding='utf-8-sig', errors='replace').read()


def strip_block_comments(s):
    return re.sub(r'/\*.*?\*/', '', s, flags=re.S)


def strip_comments(s):
    return re.sub(r'//[^\n]*', '', s)


def files_in_order():
    dme = read(os.path.join(ROOT, 'tgstation.dme'))
    for m in re.finditer(r'^#include\s+"([^"]+\.dm)"', dme, re.M):
        p = os.path.join(ROOT, *m.group(1).split('\\'))
        if os.path.exists(p):
            yield p


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
        depth = v.count('(') - v.count(')')
        while depth > 0 and i + 1 < len(body):
            i += 1
            v += '\n' + body[i]
            depth += body[i].count('(') - body[i].count(')')
        out[k] = v.strip() if v.strip().startswith('"') else strip_comments(v).strip()
        i += 1
    return out


def plist(v):
    v = strip_comments(v or '').strip()
    if not v.startswith('list('):
        return []
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
    s = (s or '').strip()
    s = s[1:-1] if len(s) > 1 and s[0] == s[-1] == '"' else s
    return s.replace('\\improper ', '').replace('\\proper ', '').replace('\\"', '"')


def num(v):
    v = strip_comments(v or '').strip()
    try:
        return float(v) if '.' in v else int(v)
    except ValueError:
        return None


WANT = ('/obj/item/seeds', '/obj/item/reagent_containers/food/snacks/grown', '/obj/item/grown',
        '/datum/reagent', '/datum/plant_gene', '/obj/machinery/vending/hydroseeds', '/obj/item/reagent_containers/food',
        '/obj/item', '/mob/living')
raw, where = {}, {}
for f in files_in_order():
    text = strip_block_comments(read(f))
    if not any(w in text for w in ('/obj/item/seeds', 'grown', '/datum/reagent', 'plant_gene', 'hydroseeds')):
        continue
    for path, body in blocks(text):
        if not path or '/proc/' in path or '/verb/' in path or not path.startswith(WANT):
            continue
        where.setdefault(path, os.path.relpath(f, ROOT).replace('\\', '/'))
        vs = parse_vars(body)
        if vs:
            raw.setdefault(path, {}).update(vs)
        else:
            raw.setdefault(path, {})


def parent_of(path):
    vs = raw.get(path, {})
    if 'parent_type' in vs:
        return vs['parent_type'].strip()
    p = path.rsplit('/', 1)[0]
    return p if p.count('/') >= 2 else None


_cache = {}


def resolve(path, depth=0):
    if path in _cache:
        return _cache[path]
    par = parent_of(path)
    base = dict(resolve(par, depth + 1)) if par and depth < 20 else {}
    base.update(raw.get(path, {}))
    _cache[path] = base
    return base


def reagent_name(path):
    r = resolve(path)
    return unq(r.get('name', '')) or path.rsplit('/', 1)[-1]


def short(path, prefix):
    return path[len(prefix):].strip('/') if path.startswith(prefix) else path


SEED = '/obj/item/seeds'
DEF = {'lifespan': 25, 'endurance': 15, 'maturation': 6, 'production': 6, 'yield': 3, 'potency': 10,
       'instability': 5, 'weed_rate': 1, 'weed_chance': 5, 'rarity': 0, 'growthstages': 6}

# ---------- ассортимент MegaSeed ----------
vend = resolve('/obj/machinery/vending/hydroseeds')
shop, contra = set(), set()
for m in re.finditer(r'(/obj/item/seeds[\w/]*)\s*=', vend.get('product_categories', '') + vend.get('products', '')):
    shop.add(m.group(1))
for m in re.finditer(r'(/obj/item/seeds[\w/]*)\s*=', vend.get('contraband', '')):
    contra.add(m.group(1))

# ---------- растения ----------
SKIP = {'/obj/item/seeds', '/obj/item/seeds/sample', '/obj/item/seeds/sample/alienweed', '/obj/item/seeds/lavaland',
        '/obj/item/seeds/xenoarch', '/obj/item/seeds/random'}
plants, mut_from = {}, {}
for path in sorted(p for p in raw if p.startswith(SEED + '/')):
    if path in SKIP or '/proc' in path:
        continue
    r = resolve(path)
    if not r.get('product') and not r.get('plantname'):
        continue
    sid = short(path, SEED)
    prod = (r.get('product') or '').strip()
    pr = resolve(prod) if prod.startswith('/') else {}
    genes = []
    for g in plist(r.get('genes')):
        g = g.strip()
        if g.startswith('/datum/plant_gene/trait'):
            genes.append(short(g, '/datum/plant_gene/trait'))
    reag = []
    for it in plist(r.get('reagents_add')):
        kv = re.match(r'(/datum/reagent[\w/]*)\s*=\s*([\d.]+)', it)
        if kv:
            reag.append([short(kv.group(1), '/datum/reagent'), float(kv.group(2))])
    muts = [short(m.strip(), SEED) for m in plist(r.get('mutatelist')) if m.strip().startswith(SEED)]
    for m in muts:
        mut_from.setdefault(m, []).append(sid)
    p = {
        'en': unq(r.get('plantname', '')) or unq(r.get('name', '')),
        'seed': unq(r.get('name', '')),
        'prod': unq(pr.get('name', '')) if pr else '',
        'pdesc': unq(pr.get('desc', '')) if pr else '',
        'kind': 'grown' if '/grown' in prod else ('mob' if prod.startswith('/mob') else 'item'),
        'icon': (pr.get('icon') or "'icons/obj/hydroponics/harvest.dmi'").strip("'").split('/')[-1] if pr else '',
        'istate': unq(strip_comments(pr.get('icon_state', ''))) if pr else '',
        'sicon': (r.get('icon') or "'icons/obj/hydroponics/seeds.dmi'").strip("'"),
        'sstate': unq(strip_comments(r.get('icon_state', ''))),
        'genes': genes,
        'reag': reag,
        'mut': muts,
    }
    for k, d in DEF.items():
        v = num(r.get(k, str(d)))
        p[k[0:3] if k not in ('weed_rate', 'weed_chance') else ('wr' if k == 'weed_rate' else 'wc')] = d if v is None else v
    if pr:
        if 'grind_results' in pr:
            p['grind'] = [short(m.group(1), '/datum/reagent') for m in re.finditer(r'(/datum/reagent[\w/]*)', pr['grind_results'])]
        if 'juice_results' in pr:
            p['juice'] = [short(m.group(1), '/datum/reagent') for m in re.finditer(r'(/datum/reagent[\w/]*)', pr['juice_results'])]
        if pr.get('distill_reagent', '').startswith('/datum/reagent'):
            p['distill'] = short(pr['distill_reagent'], '/datum/reagent')
    src = []
    if path in shop:
        src.append('shop')
    if path in contra:
        src.append('contra')
    wf = where.get(path, '')
    if '/lavaland' in path or 'lavaland' in wf:
        src.append('lava')
    if 'xenoarch' in wf:
        src.append('xeno')
    if 'diona' in wf:
        src.append('diona')
    p['src'] = src
    plants[sid] = p

for sid, froms in mut_from.items():
    if sid in plants:
        plants[sid]['from'] = sorted(set(froms))
        if not plants[sid]['src']:
            plants[sid]['src'] = ['mut']

# ---------- черты (гены) ----------
traits = {}
for path in raw:
    if path.startswith('/datum/plant_gene/trait/') and '/proc' not in path:
        r = resolve(path)
        traits[short(path, '/datum/plant_gene/trait')] = unq(r.get('name', ''))

# ---------- названия реагентов ----------
used = set()
for p in plants.values():
    used.update(x[0] for x in p['reag'])
    used.update(p.get('grind', []))
    used.update(p.get('juice', []))
    if p.get('distill'):
        used.add(p['distill'])
reag_names = {r: reagent_name('/datum/reagent/' + r) for r in sorted(used)}

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
            states.setdefault(cur[0], idx)
        elif cur and line.startswith('dirs'):
            cur[1] = int(line.split('=')[1])
        elif cur and line.startswith('frames'):
            cur[2] = int(line.split('=')[1])
    return {'fw': fw, 'fh': fh, 'cols': w // fw, 'states': states,
            'png': 'data:image/png;base64,' + base64.b64encode(data).decode()}


sheets = {}
for p in plants.values():
    rel = p['sicon']
    full = os.path.join(ROOT, *rel.split('/'))
    if not os.path.exists(full):
        rel = 'icons/obj/hydroponics/seeds.dmi'
        full = os.path.join(ROOT, *rel.split('/'))
    p['sicon'] = rel
    if rel not in sheets:
        sheets[rel] = dmi(full)
    if p['sstate'] not in sheets[rel]['states']:
        p['sstate'] = ''

# продукты: ищем лист по имени файла среди известных мест
prod_paths = {}
for root_dir in ('icons', 'modular_bluemoon/icons', 'modular_splurt/icons', 'modular_sand/icons', 'modular_citadel/icons'):
    base = os.path.join(ROOT, *root_dir.split('/'))
    for dp, _, fs in os.walk(base):
        for fn in fs:
            if fn.endswith('.dmi'):
                rel = os.path.relpath(os.path.join(dp, fn), ROOT).replace('\\', '/')
                prod_paths.setdefault(fn, []).append(rel)
for sid, p in plants.items():
    seed_raw = resolve(SEED + '/' + sid)
    prod = (seed_raw.get('product') or '').strip()
    pr = resolve(prod) if prod.startswith('/') else {}
    icon = (pr.get('icon') or "'icons/obj/hydroponics/harvest.dmi'").strip("'")
    full = os.path.join(ROOT, *icon.split('/'))
    rel = icon
    if not os.path.exists(full):
        p['icon'] = ''
        continue
    if rel not in sheets:
        sheets[rel] = dmi(full)
    p['icon'] = rel
    if p['istate'] not in sheets[rel]['states']:
        p['icon'] = ''

# Только листы, которые реально нужны; большие чужие листы (например, мобы) не тащим
need = {p['icon'] for p in plants.values() if p['icon']} | {p['sicon'] for p in plants.values()}
big = {k for k in need if len(sheets[k]['png']) > 200_000}
for p in plants.values():
    if p['icon'] in big:
        p['icon'] = ''
need = {p['icon'] for p in plants.values() if p['icon']} | {p['sicon'] for p in plants.values()}
sheets = {k: v for k, v in sheets.items() if k in need}

data = {'plants': plants, 'traits': traits, 'reag': reag_names, 'sheets': sheets}
with open(OUT, 'w', encoding='utf-8') as fp:
    fp.write('// Сгенерировано botany/build_data.py из кода BlueMoon-Station. Руками не править.\n')
    fp.write('window.BOTANY_DATA = ')
    json.dump(data, fp, ensure_ascii=False, separators=(',', ':'))
    fp.write(';\n')
print(f'{len(plants)} растений, {len(traits)} черт, {len(reag_names)} реагентов, {len(sheets)} листов, '
      f'{os.path.getsize(OUT) // 1024} КБ -> {OUT}')
