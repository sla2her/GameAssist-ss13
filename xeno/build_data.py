"""Собирает xeno/data.js из кода BlueMoon-Station: таблица мутаций слаймов, реакции экстрактов, кроссбриды, спрайты.

Запуск: python xeno/build_data.py <корень BlueMoon-Station>
Описания эффектов на русском страница держит сама (по id реакции и по типу кроссбрида), а всё, что
проверяется кодом — какие цвета во что мутируют, что капать в экстракт, какие кроссбриды существуют, —
берётся отсюда, чтобы не разъезжалось с игрой.
"""
import base64, json, os, re, struct, sys, zlib

ROOT = sys.argv[1] if len(sys.argv) > 1 else r'D:\Git\BlueMoon-Station'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.js')
XB = os.path.join(ROOT, 'code', 'modules', 'research', 'xenobiology')


def read(p):
    return re.sub(r'/\*.*?\*/', '', open(p, encoding='utf-8-sig', errors='replace').read(), flags=re.S)


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


def var(body, name):
    for line in body:
        m = re.match(r'^\t' + name + r'\s*=\s*(.*?)\s*(?://.*)?$', line)
        if m:
            return m.group(1)
    return None


def paths(v):
    return [p.rsplit('/', 1)[-1] for p in re.findall(r'/datum/reagent[\w/]*', v or '')]


# ---------- мутации ----------
text = read(os.path.join(ROOT, 'code', 'modules', 'mob', 'living', 'simple_animal', 'slime', 'subtypes.dm'))
mut = {}
for m in re.finditer(r'if\("([\w ]+)"\)\s*\n((?:\s*slime_mutation\[\d\] = "[\w ]+"\s*\n)+)', text):
    mut[m.group(1)] = re.findall(r'= "([\w ]+)"', m.group(2))
slime = read(os.path.join(ROOT, 'code', 'modules', 'mob', 'living', 'simple_animal', 'slime', 'slime.dm'))
chance = int(re.search(r'var/mutation_chance = (\d+)', slime).group(1))

# ---------- экстракты: что капать для активации ----------
extracts = {}
for path, body in blocks(read(os.path.join(XB, 'xenobiology.dm'))):
    m = re.fullmatch(r'/obj/item/slime_extract/(\w+)', path)
    if m:
        col = (var(body, 'name') or '').strip('"').replace(' slime extract', '')
        act = var(body, 'activate_reagents') or ''
        extracts[col] = {'id': m.group(1), 'cross': (var(body, 'effectmod') or '').strip('"'),
                         'act': paths(act) + re.findall(r'"([\w ]+)"', act)}
col_by_id = {v['id']: k for k, v in extracts.items()}

# ---------- реакции экстрактов ----------
rx, order = {}, []
for path, body in blocks(read(os.path.join(ROOT, 'code', 'modules', 'reagents', 'chemistry', 'recipes', 'slime_extracts.dm'))):
    if not path.startswith('/datum/chemical_reaction/slime/') or '/proc' in path:
        continue
    r = rx.setdefault(path, {})
    for k in ('name', 'id', 'required_reagents', 'required_container', 'results', 'deletes_extract'):
        v = var(body, k)
        if v is not None:
            r[k] = v
    if path not in order:
        order.append(path)


def resolve(path):
    par = path.rsplit('/', 1)[0]
    base = dict(resolve(par)) if par in rx else {}
    base.update(rx.get(path, {}))
    return base


reactions = []
for p in order:
    r = resolve(p)
    cont = (r.get('required_container') or '').rsplit('/', 1)[-1]
    if cont not in col_by_id:
        continue
    req = []
    for m in re.finditer(r'(/datum/reagent[\w/]*)\s*=\s*(\d+)', r.get('required_reagents', '')):
        req.append([m.group(1).rsplit('/', 1)[-1], int(m.group(2))])
    res = [[m.group(1).rsplit('/', 1)[-1], int(m.group(2))]
           for m in re.finditer(r'(/datum/reagent[\w/]*)\s*=\s*(\d+)', r.get('results', ''))]
    rid = (r.get('id') or '').strip('"')
    if rid.startswith('/'):
        rid = rid.rsplit('/', 1)[-1]
    reactions.append({'id': rid, 'name': (r.get('name') or '').strip('"'), 'col': col_by_id[cont],
                      'req': req, 'res': res})

# ---------- кроссбриды ----------
cross = {}
for f in sorted(os.listdir(os.path.join(XB, 'crossbreeding'))):
    if f.startswith('_'):
        continue
    for path, body in blocks(read(os.path.join(XB, 'crossbreeding', f))):
        m = re.fullmatch(r'/obj/item/slimecross/(\w+)/(\w+)', path)
        if m and var(body, 'colour'):
            cross.setdefault(m.group(1), []).append(var(body, 'colour').strip('"'))
cdef = read(os.path.join(XB, 'crossbreeding', '__corecross.dm'))
need = int(re.search(r'SLIME_EXTRACT_CROSSING_REQUIRED\s+(\d+)', open(
    os.path.join(ROOT, 'code', '__DEFINES', 'mobs.dm'), encoding='utf-8').read()).group(1))
tint = dict(re.findall(r'if\("([\w ]+)"\)\s*\n\s*itemcolor = "(#[0-9A-Fa-f]{6})"', cdef))


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


sheets = {'slimes': dmi(os.path.join(ROOT, 'icons', 'mob', 'slimes.dmi')),
          'cross': dmi(os.path.join(ROOT, 'icons', 'obj', 'slimecrossing.dmi'))}

data = {'mut': mut, 'chance': chance, 'extracts': extracts, 'reactions': reactions, 'cross': cross,
        'crossNeed': need, 'tint': tint, 'sheets': sheets}
with open(OUT, 'w', encoding='utf-8') as fp:
    fp.write('// Сгенерировано xeno/build_data.py из кода BlueMoon-Station. Руками не править.\n')
    fp.write('window.XENO_DATA = ')
    json.dump(data, fp, ensure_ascii=False, separators=(',', ':'))
    fp.write(';\n')
print(f'{len(extracts)} экстрактов, {len(reactions)} реакций, {sum(map(len, cross.values()))} кроссбридов, '
      f'{os.path.getsize(OUT) // 1024} КБ -> {OUT}')
