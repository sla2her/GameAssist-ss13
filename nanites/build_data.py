"""Собирает nanites/data.js из кода нанитов BlueMoon (code/modules/research/nanites).

Запуск: python nanites/build_data.py <корень BlueMoon-Station>
Берёт программы (nanite_programs/*.dm с наследованием переменных и доп. настроек), дизайны (designs/nanite_designs.dm)
и узлы исследований (techweb/nodes/nanites_nodes.dm, bepis_nodes.dm) и пишет window.NANITE_DATA.
Пояснения к механике (числа эффектов, советы) страница держит сама — они в коде почти не меняются.
"""
import glob, json, os, re, subprocess, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else r'D:\Git\BlueMoon-Station'
NAN = os.path.join(ROOT, 'code', 'modules', 'research', 'nanites')
RES = os.path.join(ROOT, 'code', 'modules', 'research')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.js')
BASE = '/datum/nanite_program'


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
            while i < len(s) and s[i] != '\n':
                i += 1
            continue
        out.append(c)
        i += 1
    return ''.join(out)


def blocks(text):
    """(путь, строки тела) для объявлений верхнего уровня; процедуры — путь с '/proc' или '(…)'."""
    cur, body = None, []
    for line in text.splitlines():
        if line and not line[0].isspace() and not line.startswith(('//', '#')):
            if cur:
                yield cur, body
            m = re.match(r'^(/[\w/]+(?:\([^)]*\))?)', line)
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
        while (depth > 0 or v.rstrip().endswith('\\')) and i + 1 < len(body):
            i += 1
            v = v.rstrip().rstrip('\\') + ' ' + body[i].strip()
            depth = v.count('(') - v.count(')')
        out[k] = strip_comments(v).strip()
        i += 1
    return out


def split_args(s):
    """Аргументы через запятую верхнего уровня."""
    out, depth, q, cur = [], 0, False, ''
    for c in s:
        if c == '"':
            q = not q
        if not q:
            if c in '([':
                depth += 1
            elif c in ')]':
                depth -= 1
            elif c == ',' and depth == 0:
                out.append(cur.strip())
                cur = ''
                continue
        cur += c
    if cur.strip():
        out.append(cur.strip())
    return out


def plist(v):
    v = (v or '').strip()
    if not v.startswith('list('):
        return []
    return split_args(v[5:v.rfind(')')])


def unq(v):
    v = (v or '').strip()
    return v[1:-1] if len(v) >= 2 and v[0] == '"' and v[-1] == '"' else v


def num(v, defines=None):
    if v is None:
        return None
    v = v.strip()
    m = re.match(r'^(-?[\d.]+)\s*(SECONDS|MINUTES)?$', v)
    if m:
        n = float(m.group(1)) * {'SECONDS': 10, 'MINUTES': 600}.get(m.group(2), 1)
        return int(n) if n == int(n) else n
    if v in ('TRUE', 'FALSE'):
        return v == 'TRUE'
    return v


# ---------- defines ----------
DEF = {}
for p in glob.glob(os.path.join(ROOT, 'code', '__DEFINES', '**', '*.dm'), recursive=True):
    for m in re.finditer(r'^#define\s+(\w+)\s+(.+?)\s*(?://.*)?$', read(p), re.M):
        DEF.setdefault(m.group(1), m.group(2).strip())


def included():
    """Файлы из tgstation.dme — модульные папки (modular_sand, modular_splurt…) правят наниты поверх code/."""
    dme = os.path.join(ROOT, 'tgstation.dme')
    if not os.path.exists(dme):
        return None
    return [os.path.join(ROOT, *m.group(1).split('\\')) for m in re.finditer(r'^#include\s+"([^"]+\.dm)"', read(dme), re.M)]


INC = included()


def files(pattern_re, fallback):
    if INC is None:
        return sorted(glob.glob(fallback, recursive=True))
    return [f for f in INC if re.search(pattern_re, f.replace('\\', '/')) and os.path.exists(f)]


def dval(v):
    v = v.strip()
    if v in DEF:
        return dval(DEF[v])
    if v.startswith('"'):
        return unq(v)
    n = num(v)
    return n


# ---------- программы ----------
progs, procs = {}, {}
PROG_FILES = files(r'/research/nanites/(nanite_programs/[^/]+|nanite_programs)\.dm$', os.path.join(NAN, 'nanite_programs', '*.dm'))
if os.path.join(NAN, 'nanite_programs.dm') not in PROG_FILES:
    PROG_FILES.append(os.path.join(NAN, 'nanite_programs.dm'))
for f in PROG_FILES:
    group = os.path.splitext(os.path.basename(f))[0]
    for path, body in blocks(read(f)):
        if not path or not path.startswith(BASE):
            continue
        if '(' in path:  # процедура
            pm = re.match(r'^(/[\w/]+?)(?:/proc)?/(\w+)\(', path)
            if pm:
                procs[(pm.group(1), pm.group(2))] = body
            continue
        d = progs.setdefault(path, {'vars': {}, 'file': group})
        d['vars'].update(parse_vars(body))
        d['file'] = group


def parent(p):
    return p.rsplit('/', 1)[0] if p.count('/') > 2 else None


def resolve(p, key, default=None):
    while p:
        if p in progs and key in progs[p]['vars']:
            return progs[p]['vars'][key]
        p = parent(p)
    return default


def extra_settings(p):
    """Доп. настройки программы по register_extra_settings() с учётом '. = ..()'."""
    q = p
    while q and (q, 'register_extra_settings') not in procs:
        q = parent(q)
    if not q:
        return []
    body = procs[(q, 'register_extra_settings')]
    out = []
    if any(re.match(r'^\s*(\.\s*=\s*)?\.\.\(\)', l) for l in body):
        out += extra_settings(parent(q))
    text = '\n'.join(body)
    local = {m.group(1): m.group(2) for m in re.finditer(r'var/list/(\w+)\s*=\s*(list\([^)]*\))', text, re.S)}
    for m in re.finditer(r'extra_settings\[("[^"]+"|\w+)\]\s*=\s*new\s*/datum/nanite_extra_setting/(\w+)\((.*)\)\s*$', text, re.M):
        name, kind, args = dval(m.group(1)), m.group(2), split_args(m.group(3))
        s = {'name': name, 'type': kind}
        if kind == 'number':
            s.update(value=dval(args[0]), min=dval(args[1]), max=dval(args[2]))
            if len(args) > 3:
                s['unit'] = unq(args[3])
        elif kind == 'boolean':
            s.update(value=args[0] == 'TRUE', on=unq(args[1]), off=unq(args[2]))
        elif kind == 'type':
            opts = args[1]
            if opts in local:
                opts = local[opts]
            s.update(value=dval(args[0]), options=[dval(x) for x in plist(opts)])
        elif kind == 'text':
            s.update(value=unq(args[0]))
        out = [x for x in out if x['name'] != name] + [s]
    return out


def sub_options(p):
    """Варианты зависимой настройки (галлюцинации: Hallucination Detail по типу)."""
    q = p
    while q and (q, 'set_extra_setting') not in procs:
        q = parent(q)
    if not q:
        return None
    text = '\n'.join(procs[(q, 'set_extra_setting')])
    res = {}
    for m in re.finditer(r'if\("([^"]+)"\)\s*\n\s*extra_settings\[\w+\]\s*=\s*new\s*/datum/nanite_extra_setting/(\w+)\((.*)\)', text):
        args = split_args(m.group(3))
        res[m.group(1)] = [dval(x) for x in plist(args[1])] if m.group(2) == 'type' and len(args) > 1 else []
    return res or None


def ds(v):
    """Децисекунды → секунды."""
    n = num(v)
    return round(n / 10, 1) if isinstance(n, (int, float)) else None


# ---------- дизайны и узлы ----------
designs = {}
for path, body in blocks(read(os.path.join(RES, 'designs', 'nanite_designs.dm'))):
    if not path or not path.startswith('/datum/design/nanites/') or '(' in path:
        continue
    v = parse_vars(body)
    if 'program_type' in v:
        designs[unq(v.get('id'))] = {'id': unq(v.get('id')), 'type': v['program_type'].strip(),
                                     'cat': unq((plist(v.get('category')) or ['""'])[0]),
                                     'dname': unq(v.get('name')), 'ddesc': unq(v.get('desc'))}

NODE_FILES = files(r'/techweb/', os.path.join(ROOT, '**', 'techweb', '**', '*.dm'))
nodes = []
mods = []  # (id, +[…], −[…]) из /datum/techweb_node/<id>/New() модульных папок
for f in NODE_FILES:
    for path, body in blocks(read(f)):
        m = re.match(r'^/datum/techweb_node/(\w+)/New\(', path or '')
        if m:
            text = '\n'.join(body)
            add = [unq(x) for mm in re.finditer(r'design_ids\s*\+=\s*(list\([^)]*\)|"[^"]+")', text) for x in (plist(mm.group(1)) or [mm.group(1)])]
            local = {mm.group(1): plist(mm.group(2)) for mm in re.finditer(r'var/list/(\w+)\s*=\s*(list\([^)]*\))', text, re.S)}
            rem = [unq(x) for mm in re.finditer(r'LAZYREMOVE\(design_ids,\s*(\w+)\)', text) for x in local.get(mm.group(1), [])]
            mods.append((m.group(1), add, rem))
for f in NODE_FILES:
    for path, body in blocks(read(f)):
        if not path or not path.startswith('/datum/techweb_node/') or '(' in path:
            continue
        v = parse_vars(body)
        ids = [unq(x) for x in plist(v.get('design_ids'))]
        if not any(i in designs for i in ids) and 'nanite' not in unq(v.get('id', '')):
            continue
        cost = re.search(r'=\s*(\d+)', v.get('research_costs', ''))
        nodes.append({'id': unq(v.get('id')), 'name': unq(v.get('display_name')), 'desc': unq(v.get('description')),
                      'pre': [unq(x) for x in plist(v.get('prereq_ids'))], 'designs': ids,
                      'cost': int(cost.group(1)) if cost else 0,
                      'hidden': v.get('hidden') == 'TRUE', 'exp': v.get('experimental') == 'TRUE'})

for nid, add, rem in mods:
    for n in nodes:
        if n['id'] == nid:
            n['designs'] = [i for i in n['designs'] if i not in rem] + [i for i in add if i not in n['designs']]
            n['mod'] = n.get('mod', []) + [i for i in add if i in designs] + ['-' + i for i in rem]

# названия всех узлов — для пререквизитов вне нанитной ветки
names = {}
for f in NODE_FILES:
    for path, body in blocks(read(f)):
        if path and path.startswith('/datum/techweb_node/') and '(' not in path:
            v = parse_vars(body)
            if 'id' in v and 'display_name' in v:
                names[unq(v['id'])] = unq(v['display_name'])

node_of = {}
for n in nodes:
    for i in n['designs']:
        node_of.setdefault(i, n['id'])

# ---------- сборка ----------
by_type = {d['type']: d for d in designs.values()}
out = []
for p, d in progs.items():
    name = unq(resolve(p, 'name', ''))
    if p == BASE or not name or name in ('Generic Nanite Program', 'Nanite Protocol', 'Sensor Nanites') \
            and p not in by_type:
        continue
    if p in ('/datum/nanite_program/lockout', '/datum/nanite_program/comm', '/datum/nanite_program/protocol',
             '/datum/nanite_program/sensor'):
        continue
    des = by_type.get(p)
    flags = resolve(p, 'program_flags', 'NONE')
    rec = {
        'id': p[len(BASE) + 1:],
        'name': name,
        'desc': unq(resolve(p, 'desc', '')),
        'group': d['file'],
        'use': num(resolve(p, 'use_rate', '0')),
        'unique': num(resolve(p, 'unique', 'TRUE')),
        'trig': num(resolve(p, 'can_trigger', 'FALSE')),
        'tcost': num(resolve(p, 'trigger_cost', '0')),
        'tcd': ds(resolve(p, 'trigger_cooldown', '50')),
        'rogue': [x.strip()[len(BASE) + 1:] for x in plist(resolve(p, 'rogue_types', 'list(/datum/nanite_program/glitch)'))],
        'emp': 'NANITE_EMP_IMMUNE' in flags, 'shock': 'NANITE_SHOCK_IMMUNE' in flags,
        'rule': num(resolve(p, 'can_rule', 'FALSE')) is True,
        'proto': {'NANITE_PROTOCOL_REPLICATION': 'rep', 'NANITE_PROTOCOL_STORAGE': 'sto'}.get(resolve(p, 'protocol_class', ''), ''),
        'comm': p.startswith(BASE + '/comm/'),
        'set': extra_settings(p),
    }
    so = sub_options(p)
    if so:
        rec['sub'] = so
    if des:
        rec.update(design=des['id'], cat=des['cat'], node=node_of.get(des['id'], ''))
        if des['ddesc'] and des['ddesc'] != rec['desc']:
            rec['hub'] = des['ddesc']
    else:
        rec.update(design='', cat='Defective Nanites' if d['file'] == 'rogue' else '', node='')
    out.append(rec)

ORDER = ['Utility Nanites', 'Medical Nanites', 'Augmentation Nanites', 'Sensor Nanites', 'Protocols_Nanites',
         'Suppression Nanites', 'Weaponized Nanites', 'Defective Nanites', '']
out.sort(key=lambda r: (ORDER.index(r['cat']) if r['cat'] in ORDER else 99, r['name']))

# запас нанитов: базовый компонент и модульные правки (modular_splurt ставит max_nanites = 500)
comp = {}
for f in files(r'/components/nanites\.dm$', os.path.join(ROOT, '**', 'components', 'nanites.dm')):
    for path, body in blocks(read(f)):
        if path == '/datum/component/nanites':
            comp.update(parse_vars(body))

rev = {}
try:
    g = lambda *a: subprocess.check_output(['git', '-C', ROOT] + list(a), text=True).strip()
    rev = {'commit': g('rev-parse', '--short', 'HEAD'), 'date': g('log', '-1', '--format=%cs')}
except Exception:
    pass

data = {'rev': rev, 'programs': out, 'nodes': nodes,
        'node_names': {k: names[k] for n in nodes for k in n['pre'] if k in names},
        'limits': {'max_programs': num(DEF.get('NANITE_PROGRAM_LIMIT', '20')),
                   'max': num(comp.get('max_nanites', '250')), 'regen': num(comp.get('regen_rate', '0.5')),
                   'safety': num(comp.get('safety_threshold', '25')),
                   'sync': DEF.get('NANITE_SYNC_DELAY', '30 SECONDS')}}
with open(OUT, 'w', encoding='utf-8', newline='\n') as fh:
    fh.write('// Сгенерировано build_data.py из кода нанитов BlueMoon — руками не править\n')
    fh.write('window.NANITE_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')

miss = [r['name'] for r in out if not r['design'] and r['group'] != 'rogue']
print(f'{len(out)} программ, {len(nodes)} узлов → {OUT}')
if miss:
    print('Без дизайна (не исследуются):', ', '.join(miss))
orphan = [i for i in designs if i not in node_of]
if orphan:
    print('Дизайны вне узлов:', ', '.join(orphan))
