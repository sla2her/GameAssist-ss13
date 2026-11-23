"""Собирает rnd/data.js — техвеб BlueMoon для приложения «R&D».

Запуск: python rnd/build_data.py <корень BlueMoon-Station>
Идёт по файлам в порядке tgstation.dme, как компилятор: узлы /datum/techweb_node (с наследованием
и правками в New() из modular_*), дизайны /datum/design, предметы для разборки на очки
(SSresearch.techweb_point_items) и названия предметов для бустов. Пишет window.RND_DATA.
"""
import json, os, re, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else r'D:\Git\BlueMoon-Station'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.js')


def read(p):
    return open(p, encoding='utf-8-sig', errors='replace').read()


def strip_block_comments(s):
    out, i, depth, n = [], 0, 0, len(s)
    in_str = False
    while i < n:
        c = s[i]
        if depth == 0 and c == '"' and (i == 0 or s[i - 1] != '\\'):
            in_str = not in_str
        if not in_str and s.startswith('/*', i):
            depth += 1; i += 2; continue
        if depth and s.startswith('*/', i):
            depth -= 1; i += 2; continue
        if c == '\n':
            in_str = False
        if depth == 0 or c == '\n':
            out.append(c)
        i += 1
    return ''.join(out)


def strip_line_comment(s):
    out, in_str = [], False
    for i, c in enumerate(s):
        if c == '"' and (i == 0 or s[i - 1] != '\\'):
            in_str = not in_str
        if not in_str and s.startswith('//', i):
            break
        out.append(c)
    return ''.join(out)


def blocks(text):
    cur, body = None, []
    for line in text.splitlines():
        if line and not line[0].isspace() and not line.startswith(('//', '#')):
            if cur:
                yield cur, body
            m = re.match(r'^(/[\w/]+(?:\([^)]*\))?)\s*(?://.*)?$', line)
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
        k, v = m.group(1), strip_line_comment(m.group(2))
        depth = v.count('(') - v.count(')')
        while depth > 0 and i + 1 < len(body):
            i += 1
            nxt = strip_line_comment(body[i])
            v += '\n' + nxt
            depth += nxt.count('(') - nxt.count(')')
        out[k] = v.strip()
        i += 1
    return out


def split_top(inner):
    items, depth, cur, in_str = [], 0, '', False
    for i, ch in enumerate(inner):
        if ch == '"' and (i == 0 or inner[i - 1] != '\\'):
            in_str = not in_str
        if not in_str:
            depth += (ch == '(') - (ch == ')')
            if ch == ',' and depth == 0:
                items.append(cur.strip()); cur = ''; continue
        cur += ch
    if cur.strip():
        items.append(cur.strip())
    return items


def plist(v):
    v = (v or '').strip()
    if not v.startswith('list('):
        return []
    return split_top(v[5:v.rfind(')')])


def unq(s):
    s = (s or '').strip()
    if len(s) > 1 and s[0] == s[-1] == '"':
        s = s[1:-1]
    s = re.sub(r'\\(?:the|The|a|an|improper|proper|roman|Roman)\s*', '', s)
    return s.replace('\\"', '"').replace("\\'", "'").strip()


# ---------- файлы в порядке компиляции ----------
dme = read(os.path.join(ROOT, 'tgstation.dme'))
files = [m.group(1).replace('\\', '/') for m in re.finditer(r'^#include\s+"([^"]+\.dm)"', dme, re.M)]

DEFINES = {}
types = {}           # путь → слитые var (поздний файл перекрывает)
type_file = {}       # путь → файл, где объявлен id (для категорий)
procs = []           # (путь, тело New())
names = {}           # путь предмета → name (для бустов и разборки)
objvars = {}         # путь /obj → name, icon, icon_state (для спрайтов)
texts = {}

for f in files:
    p = os.path.join(ROOT, f)
    if not os.path.exists(p):
        continue
    t = read(p)
    if '/datum/techweb_node' not in t and '/datum/design' not in t and '#define' not in t and 'name' not in t:
        continue
    t = strip_block_comments(t)
    for m in re.finditer(r'^#define\s+(\w+)\s+(.+)$', t, re.M):
        DEFINES[m.group(1)] = strip_line_comment(m.group(2)).strip()
    if 'research.dm' in f and 'subsystem' in f:
        texts['ssresearch'] = t
    for path, body in blocks(t):
        if not path:
            continue
        if path.startswith(('/datum/techweb_node', '/datum/design')):
            if '(' in path:
                if path.endswith('/New()'):
                    procs.append((path[:-6], body))
                continue
            v = parse_vars(body)
            types.setdefault(path, {}).update(v)
            if 'id' in v:
                type_file[path] = f
        elif path.startswith('/obj') and '(' not in path:
            for line in body:
                m = re.match(r'^\t(name|icon|icon_state)\s*=\s*(".*"|\'[^\']*\')\s*$', strip_line_comment(line))
                if m:
                    ov = objvars.setdefault(path, {})
                    ov[m.group(1)] = m.group(2)[1:-1] if m.group(1) != 'name' else unq(m.group(2))
                    if m.group(1) == 'name':
                        names[path] = ov['name']


def num(expr, depth=0):
    expr = strip_line_comment(expr or '').strip()
    if not expr or depth > 8:
        return None
    def rep(m):
        w = m.group(0)
        if w in DEFINES:
            val = num(DEFINES[w], depth + 1)
            return str(val) if val is not None else w
        return w
    e = re.sub(r'[A-Za-z_]\w*', rep, expr)
    e = e.replace('**', '^').replace('^', '**')
    if re.fullmatch(r'[\d\s.+\-*/()e]+', e):
        try:
            return eval(e, {'__builtins__': {}})
        except Exception:
            return None
    return None


def chain(path, root):
    out = []
    while path and path.startswith(root):
        out.append(path)
        path = path.rsplit('/', 1)[0]
    return out[::-1]


def resolved(path, root):
    r = {}
    for p in chain(path, root):
        r.update(types.get(p, {}))
    return r


def item_name(path):
    p = path
    while p.startswith('/obj'):
        if p in names:
            return names[p]
        p = p.rsplit('/', 1)[0]
    return path.rsplit('/', 1)[-1]


# ---------- дизайны ----------
BUILD = {'IMPRINTER': 'imp', 'PROTOLATHE': 'pro', 'AUTOLATHE': 'auto', 'MECHFAB': 'mech', 'BIOGENERATOR': 'bio',
         'LIMBGROWER': 'limb', 'SMELTER': 'smelt', 'NANITE_COMPILER': 'nanite', 'AUTOBOTTLER': 'bottle',
         'BIOAEGIS': 'aegis', 'TOYLATHE': 'toy', 'AWAY_LATHE': 'away', 'AWAY_IMPRINTER': 'awayimp'}
DEPT = {'DEPARTMENTAL_FLAG_SECURITY': 'sec', 'DEPARTMENTAL_FLAG_MEDICAL': 'med', 'DEPARTMENTAL_FLAG_CARGO': 'cargo',
        'DEPARTMENTAL_FLAG_SCIENCE': 'sci', 'DEPARTMENTAL_FLAG_ENGINEERING': 'eng', 'DEPARTMENTAL_FLAG_SERVICE': 'srv',
        'DEPARTMENTAL_FLAG_ALL': 'all'}
SEC = {'SEC_LEVEL_GREEN': 'green', 'SEC_LEVEL_BLUE': 'blue', 'SEC_LEVEL_AMBER': 'amber', 'SEC_LEVEL_ORANGE': 'orange',
       'SEC_LEVEL_VIOLET': 'violet', 'SEC_LEVEL_RED': 'red', 'SEC_LEVEL_LAMBDA': 'lambda', 'SEC_LEVEL_GAMMA': 'gamma',
       'SEC_LEVEL_EPSILON': 'epsilon', 'SEC_LEVEL_DELTA': 'delta'}

designs = {}
for path in types:
    if not path.startswith('/datum/design/'):
        continue
    d = resolved(path, '/datum/design')
    did = unq(d.get('id', ''))
    if not did or did == 'IGNORE_THIS_DESIGN' or 'DESIGN_ID_IGNORE' in d.get('id', ''):
        continue
    mats = {}
    for it in plist(d.get('materials', '')):
        kv = re.match(r'/datum/material/(\w+)\s*=\s*(.+)', it)
        if kv:
            a = num(kv.group(2))
            if a:
                mats[kv.group(1)] = round(a / 2000, 3)
    reag = {}
    for it in plist(d.get('reagents_list', '')):
        kv = re.match(r'/datum/reagent/([\w/]+)\s*=\s*(.+)', it)
        if kv:
            reag[kv.group(1).rsplit('/', 1)[-1]] = num(kv.group(2)) or 0
    bt = [BUILD[w] for w in re.findall(r'[A-Z_]+', d.get('build_type', '')) if w in BUILD]
    if path.startswith('/datum/design/surgery'):
        bt = ['surg']   # операции: загружаются в операционный компьютер
    dp = [DEPT[w] for w in re.findall(r'[A-Z_]+', d.get('departmental_flags', '')) if w in DEPT]
    cats = [unq(x) for x in plist(d.get('category', ''))]
    sec = SEC.get(d.get('min_security_level', '').strip())
    bp = d.get('build_path', '').strip()
    e = {'n': unq(d.get('name', '')) or did, 'b': bt}
    desc = unq(d.get('desc', ''))
    if desc and desc != 'Desc':
        e['d'] = desc
    if mats: e['m'] = mats
    if reag: e['r'] = reag
    if dp: e['dp'] = dp
    if cats: e['c'] = cats
    if sec and sec != 'green': e['sec'] = sec
    ct = num(d.get('construction_time', ''))
    if ct and 'mech' in bt: e['t'] = round(ct / 10, 1)
    e['_bp'] = bp
    if bp.startswith('/obj/'):
        nm = item_name(bp)
        if nm and nm.lower() != e['n'].lower():
            e['item'] = nm
    designs[did] = e

# ---------- узлы ----------
CATS = {'engineering': 'eng', 'medical': 'med', 'biotech': 'bio', 'robotics': 'robo', 'mecha': 'mech', 'mod': 'mod',
        'weaponry': 'weap', 'ballistics': 'weap', 'bluespace': 'bs', 'computer_hud': 'comp', 'tools': 'tools',
        'misc': 'misc', 'alien': 'alien', 'syndicate': 'synd', 'nanites': 'nanite', 'bepis': 'bepis', 'export': 'export',
        'janitor': 'tools', 'anomalock': 'med'}


def cat_of(f):
    b = os.path.basename(f).replace('_nodes.dm', '').replace('.dm', '')
    return CATS.get(b)


nodes, path_of = {}, {}
for path in types:
    if not path.startswith('/datum/techweb_node/'):
        continue
    v = resolved(path, '/datum/techweb_node')
    nid = unq(v.get('id', ''))
    if not nid or nid == 'ERROR':
        continue
    cost = 0
    for it in plist(v.get('research_costs', '')):
        kv = re.match(r'(\w+)\s*=\s*(.+)', it)
        if kv:
            cost += num(kv.group(2)) or 0
    boosts = []
    for it in plist(v.get('boost_item_paths', '')):
        kv = re.match(r'(/obj[\w/]+)\s*(?:=\s*(list\(.*\)))?', it, re.S)
        if kv:
            pts = 0
            for x in plist(kv.group(2) or ''):
                k2 = re.match(r'\w+\s*=\s*(.+)', x)
                if k2:
                    pts += num(k2.group(1)) or 0
            boosts.append([kv.group(1), pts])
    src = next((type_file[p] for p in reversed(chain(path, '/datum/techweb_node')) if p in type_file), '')
    nodes[nid] = {
        'name': unq(v.get('display_name', '')) or nid,
        'desc': unq(v.get('description', '')),
        'cost': int(cost),
        'start': v.get('starting_node', '').strip() == 'TRUE',
        'hidden': v.get('hidden', '').strip() == 'TRUE',
        'exp': v.get('experimental', '').strip() == 'TRUE',
        'auto': v.get('autounlock_by_boost', 'TRUE').strip() != 'FALSE',
        'pre': [unq(x) for x in plist(v.get('prereq_ids', ''))],
        'des': [unq(x) for x in plist(v.get('design_ids', ''))],
        'boost': boosts,
        'cat': cat_of(src),
        'src': src,
        'radio': [w.replace('RADIO_CHANNEL_', '').lower() for w in re.findall(r'RADIO_CHANNEL_\w+', v.get('informing_radio_channels', ''))],
    }
    path_of[path] = nid

# правки из New(): design_ids += / LAZYADD / LAZYREMOVE, boost_item_paths = typesof(...)
for path, body in procs:
    if not path.startswith('/datum/techweb_node'):
        continue
    targets = [nid for p, nid in path_of.items() if p == path or p.startswith(path + '/')]
    text = '\n'.join(strip_line_comment(l) for l in body)
    local = {}
    for m in re.finditer(r'var/list/(\w+)\s*=\s*(list\((?:[^()]|\([^()]*\))*\))', text, re.S):
        local[m.group(1)] = [unq(x) for x in plist(m.group(2))]

    def vals(expr):
        expr = expr.strip()
        if expr.startswith('list('):
            return [unq(x) for x in plist(expr)]
        if expr in local:
            return local[expr]
        return [unq(expr)] if expr.startswith('"') else []
    adds, rems, boost = [], [], None
    for m in re.finditer(r'design_ids\s*\+=\s*(list\([^)]*\)|"[^"]*"|\w+)', text):
        adds += vals(m.group(1))
    for m in re.finditer(r'LAZYADD\(\s*design_ids\s*,\s*(list\([^)]*\)|"[^"]*"|\w+)\s*\)', text):
        adds += vals(m.group(1))
    for m in re.finditer(r'design_ids\s*-=\s*(list\([^)]*\)|"[^"]*"|\w+)', text):
        rems += vals(m.group(1))
    for m in re.finditer(r'LAZYREMOVE\(\s*design_ids\s*,\s*(list\([^)]*\)|"[^"]*"|\w+)\s*\)', text):
        rems += vals(m.group(1))
    m = re.search(r'boost_item_paths\s*=\s*(?:typesof|list)\((.*?)\)\s*$', text, re.S | re.M)
    if m:
        boost = [[p, 0] for p in re.findall(r'/obj[\w/]+', m.group(1))]
    for nid in targets:
        n = nodes[nid]
        n['des'] = [d for d in n['des'] + [a for a in adds if a not in n['des']] if d not in rems]
        if boost is not None:
            n['boost'] = boost

# проверка как verify_techweb_nodes: чужие ссылки выкидываем
missing_d = set()
for nid, n in nodes.items():
    n['pre'] = [p for p in n['pre'] if p in nodes]
    for d in n['des']:
        if d not in designs:
            missing_d.add(d)
    n['des'] = [d for d in dict.fromkeys(n['des']) if d in designs]
    n['boost'] = [[item_name(p), pts] for p, pts in n['boost']]
for nid, n in nodes.items():
    if not n['cat']:
        for p in n['pre']:
            if nodes[p]['cat']:
                n['cat'] = nodes[p]['cat']; break
    n['cat'] = n['cat'] or 'misc'
    for k in ('hidden', 'exp', 'start'):
        if not n[k]: del n[k]
    if n['auto']: del n['auto']
    if not n['boost']: del n['boost']
    if not n['radio']: del n['radio']
    n['src'] = n['src'].split('/')[0] if n['src'].startswith('modular') else ''
    if not n['src']: del n['src']

used = {d for n in nodes.values() for d in n['des']}
designs = {k: v for k, v in designs.items() if k in used}

# ---------- спрайты дизайнов: первый кадр icon_state предмета из .dmi, всё в один атлас ----------
def obj_var(path, key):
    p = path
    while p.startswith('/obj'):
        v = objvars.get(p, {}).get(key)
        if v is not None:
            return v
        if p == '/obj':
            break
        p = p.rsplit('/', 1)[0]
    return None


def dmi_states(fp):
    """Словарь icon_state → (индекс первого кадра, ширина, высота) по описанию в PNG .dmi."""
    import struct as st, zlib as zl
    data = open(fp, 'rb').read()
    pos, desc = 8, ''
    while pos < len(data):
        ln, typ = st.unpack('>I4s', data[pos:pos + 8])
        chunk = data[pos + 8:pos + 8 + ln]
        if typ in (b'zTXt', b'tEXt'):
            key, rest = chunk.split(b'\0', 1)
            if key == b'Description':
                desc = (zl.decompress(rest[1:]) if typ == b'zTXt' else rest).decode('utf-8', 'replace')
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
    return states, fw, fh


SPR = 32
sprite_of, sprite_imgs, dmi_cache = {}, [], {}
try:
    from PIL import Image
except ImportError:
    Image = None
if Image:
    for did, e in designs.items():
        bp = e.pop('_bp', '')
        if not bp.startswith('/obj'):
            continue
        ic, ist = obj_var(bp, 'icon'), obj_var(bp, 'icon_state') or ''
        if not ic or not ic.endswith('.dmi'):
            continue
        key = (ic, ist)
        if key not in sprite_of:
            sprite_of[key] = None
            fp = os.path.join(ROOT, ic)
            if os.path.exists(fp):
                try:
                    if fp not in dmi_cache:
                        dmi_cache[fp] = (Image.open(fp).convert('RGBA'), *dmi_states(fp))
                    img, states, fw, fh = dmi_cache[fp]
                    if ist in states:
                        cols = max(1, img.width // fw)
                        i = states[ist]
                        fr = img.crop(((i % cols) * fw, (i // cols) * fh, (i % cols + 1) * fw, (i // cols + 1) * fh))
                        bb = fr.getbbox()
                        if bb:
                            if fw > SPR or fh > SPR:
                                fr = fr.crop(bb)
                                k = SPR / max(fr.width, fr.height)
                                fr = fr.resize((max(1, round(fr.width * k)), max(1, round(fr.height * k))), Image.NEAREST)
                            cell = Image.new('RGBA', (SPR, SPR))
                            cell.paste(fr, ((SPR - fr.width) // 2, (SPR - fr.height) // 2))
                            sprite_of[key] = len(sprite_imgs)
                            sprite_imgs.append(cell)
                except Exception as ex:
                    print('спрайт не прочитан:', ic, ist, ex)
        if sprite_of[key] is not None:
            e['i'] = sprite_of[key]
atlas_uri, ATL_COLS = '', 40
if sprite_imgs:
    import base64, io
    rows = (len(sprite_imgs) + ATL_COLS - 1) // ATL_COLS
    atlas = Image.new('RGBA', (ATL_COLS * SPR, rows * SPR))
    for i, im in enumerate(sprite_imgs):
        atlas.paste(im, ((i % ATL_COLS) * SPR, (i // ATL_COLS) * SPR))
    buf = io.BytesIO()
    atlas.save(buf, 'PNG', optimize=True)
    atlas_uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
for e in designs.values():
    e.pop('_bp', None)


# ---------- очки за разборку (SSresearch.techweb_point_items) ----------
points = []
ss = texts.get('ssresearch', '')
m = re.search(r'techweb_point_items\s*=\s*list\((.*?)\n\t\)', ss, re.S)
if m:
    for it in split_top(m.group(1)):
        it = '\n'.join(l for l in it.splitlines() if not l.strip().startswith('//')).strip()
        kv = re.match(r'(/obj[\w/]+)\s*=\s*list\(\s*\w+\s*=\s*([^)]+)\)', it)
        if kv:
            ip = kv.group(1)
            nm = item_name(ip)
            if ip.startswith('/obj/item/slimecross/'):   # у скрещённых экстрактов общее имя — добавляем цвет
                nm += ' (' + ip.rsplit('/', 1)[-1] + ')'
            grp = 'slime' if '/slime' in ip else ''
            points.append([nm, num(kv.group(2)) or 0, grp])

consts = {
    'server_base': num(re.search(r'base_mining_income\s*=\s*list\(\w+\s*=\s*([\d.]+)', read(os.path.join(ROOT, 'code/modules/research/server.dm'))).group(1)),
    'server_mult': num(DEFINES.get('RESEARCH_SERVER_OUTPUT_MULTIPLIER', '1')),
    'bomb_points': num(DEFINES.get('BOMB_TARGET_POINTS', '0')),
    'bomb_size': num(DEFINES.get('BOMB_TARGET_SIZE', '0')),
    'node_pay_unit': num(DEFINES.get('ECON_NODE_POINTS_UNIT', '1000')),
}
st = read(os.path.join(ROOT, 'modular_bluemoon/code/modules/economy/core/settings.dm'))
for key, rx in (('node_pay', r'WORK_SCI_NODE\s*=\s*([\d.]+)'), ('grant_price', r'research_grant_price_per_point\s*=\s*([\d.]+)'),
                ('grant_cap', r'research_grant_cap_hour\s*=\s*([\d.]+)')):
    mm = re.search(rx, st)
    consts[key] = float(mm.group(1)) if mm else None

data = {'nodes': nodes, 'designs': designs, 'points': points, 'consts': consts,
        'sprites': {'png': atlas_uri, 'size': SPR, 'cols': ATL_COLS}}
js = '// Собрано rnd/build_data.py из BlueMoon-Station — руками не править\nwindow.RND_DATA=' + \
     json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(OUT, 'w', encoding='utf-8').write(js)
print(f'{len(nodes)} узлов, {len(designs)} дизайнов, {len(sprite_imgs)} спрайтов, {len(points)} предметов на очки, '
      f'{len(missing_d)} пропавших дизайнов, {os.path.getsize(OUT) // 1024} КБ')
