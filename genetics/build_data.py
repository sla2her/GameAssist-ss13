"""Собирает genetics/data.js из исходников BlueMoon-Station: мутации и рецепты скрещивания.
Запуск: python genetics/build_data.py <путь к BlueMoon-Station>
"""
import json, os, re, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else r'D:\Git\BlueMoon-Station'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.js')

def included_files():
    """Файлы, которые реально подключены в tgstation.dme (закомментированные include не считаются)."""
    files = []
    with open(os.path.join(ROOT, 'tgstation.dme'), encoding='utf-8', errors='replace') as f:
        for line in f:
            m = re.match(r'\s*#include\s+"(.+?\.dm)"', line)
            if m:
                files.append(os.path.join(ROOT, m.group(1).replace('\\', os.sep)))
    return files

def strip_comments(src):
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c == '"':  # строка: копируем как есть, с экранированием
            j = i + 1
            while j < n and src[j] != '"' and src[j] != '\n':
                j += 2 if src[j] == '\\' else 1
            out.append(src[i:j + 1]); i = j + 1
        elif src.startswith('//', i):
            j = src.find('\n', i); i = n if j < 0 else j
        elif src.startswith('/*', i):
            j = src.find('*/', i + 2); i = n if j < 0 else j + 2
        else:
            out.append(c); i += 1
    return ''.join(out)

DEFINES = {}
def load_defines():
    for rel in ['code/__DEFINES/DNA.dm', 'code/__DEFINES/security_levels.dm']:
        p = os.path.join(ROOT, rel)
        for line in open(p, encoding='utf-8', errors='replace'):
            m = re.match(r'\s*#define\s+(\w+)\s+(.+?)\s*(//.*)?$', line)
            if m:
                DEFINES[m.group(1)] = m.group(2).strip()

def resolve(v):
    for _ in range(5):
        if v in DEFINES:
            v = DEFINES[v]
    return v

def unq(v):
    v = v.strip()
    if v.startswith('"') and v.endswith('"'):
        v = v[1:-1]
    return v.replace('\\"', '"').replace('\\n', '\n')

def clean_html(s):
    if s == 'null':
        return ''
    m = re.match(r'span_\w+\("(.*)"\)$', s)
    if m:
        s = m.group(1)
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\\(the|The|improper|proper|a|an|his|her|him|he|she|hers|himself|herself)\s*', '', s)
    return s.replace('&nbsp;', ' ').strip()

def list_items(v):
    m = re.match(r'list\((.*)\)$', v.strip(), re.S)
    if not m:
        return []
    return [resolve(x.strip()) for x in m.group(1).split(',') if x.strip()]


# Русские названия и пояснения (в игре консоль показывает английские названия из кода)
RU = {
 'acidflesh': ('Кислотная плоть', 'Под кожей копится кислота и периодически обжигает носителя. Часто смертельно.'),
 'antenna': ('Антенна', 'На лбу вырастает антенна: носитель слышит общий радиоканал без гарнитуры.'),
 'bad_dna': ('Нестабильная ДНК', 'Сразу даёт случайную мутацию (чаще вредную) и исчезает.'),
 'badblink': ('Пространственная нестабильность', 'Носителя время от времени телепортирует на несколько клеток, его тошнит.'),
 'blind': ('Слепота', 'Полная слепота.'),
 'bm/onelife': ('Одна жизнь', 'Если носитель умрёт, его тело рассыпается в пыль: клонирование и воскрешение невозможны.'),
 'bm/paraplegic': ('Парализованный', 'Ноги не работают, нужна инвалидная коляска.'),
 'bm/waddle': ('Неуклюжесть', 'Носитель забавно подпрыгивает при ходьбе.'),
 'chameleon': ('Хамелеон', 'Если стоять неподвижно, кожа становится прозрачной, и носитель почти невидим.'),
 'chav': ('Гопник', 'Речь превращается в британский уличный сленг.'),
 'clumsy': ('Неловкость', 'Неуклюжесть клоуна: роняет оружие, стреляет себе в ногу. Хонк.'),
 'cluwne': ('Клувн', 'Превращает в клувна: повреждение мозга, клоунская одежда, тупость.'),
 'cough': ('Кашель', 'Хронический кашель, из-за которого носитель роняет вещи из рук.'),
 'cryokinesis': ('Криокинез', 'Способность: заморозить цель на расстоянии.'),
 'deaf': ('Глухота', 'Полная глухота.'),
 'dwarfism': ('Карликовость', 'Носитель становится маленьким и может пролезать через столы.'),
 'elvis': ('Элвис', 'Носитель говорит и танцует как Элвис.'),
 'epilepsy': ('Эпилепсия', 'Внезапные припадки: потеря сознания и сильная дрожь.'),
 'fire': ('Огненный пот', 'Носитель иногда самовозгорается, но к огню устойчивее.'),
 'firebreath': ('Огненное дыхание', 'Способность: выдохнуть струю огня. Спящая мутация у ящеров.'),
 'flash_protection': ('Защита от вспышек', 'Глаза не слепнут от флешек и светошумовых гранат.'),
 'geladikinesis': ('Геладикинез', 'Способность: создать в руке снежок.'),
 'gigantism': ('Гигантизм', 'Носитель становится крупнее.'),
 'glow': ('Свечение', 'Носитель светится случайным цветом.'),
 'glow/anti': ('Анти-свечение', 'Вокруг носителя темнеет: он поглощает свет.'),
 'hulk': ('Халк', 'Огромная сила, бьёт стены и людей, не оглушается и не толкается. Пальцы толстые: огнестрел не держит. Ставится только при здоровье от 25, пропадает, когда здоровье падает ниже 0.'),
 'hulk/superhuman': ('Халк (супер)', 'Крайняя форма Халка: невероятная сила и живучесть. Только через админов и события.'),
 'insulated': ('Изоляция', 'Носитель не проводит ток: электричество его не бьёт.'),
 'laser_eyes': ('Лазерные глаза', 'Стрельба лазером из глаз. Только через админов и события.'),
 'mindreader': ('Чтение мыслей', 'Способность: подсмотреть свежие воспоминания и мысли цели.'),
 'mute': ('Немота', 'Носитель не может говорить.'),
 'nearsight': ('Близорукость', 'Плохое зрение, нужны очки по рецепту.'),
 'nervousness': ('Нервозность', 'Носитель заикается.'),
 'olfaction': ('Чутьё', 'Способность: взять след по запаху предмета, как ищейка.'),
 'paranoia': ('Паранойя', 'Носитель легко пугается и видит галлюцинации.'),
 'race': ('Обезьяна', 'Ген, который отличает обезьяну от человека. Активный ген превращает в мартышку.'),
 'radioactive': ('Радиоактивность', 'Носитель излучает радиацию, облучая себя и всех вокруг.'),
 'self_amputation': ('Автотомия', 'Способность: сбросить случайную конечность.'),
 'shock': ('Шоковое касание', 'Способность: ударить током через руки, сам носитель не страдает.'),
 'smile': ('Улыбка', 'Носитель в постоянной мании и говорит только хорошее.'),
 'space_adaptation': ('Космическая адаптация', 'Иммунитет к холоду и давлению космоса. Кислород всё равно нужен.'),
 'spastic': ('Спазмы', 'Мышечные спазмы: носитель дёргается и роняет вещи.'),
 'stimmed': ('Стимулированный', 'Химический баланс крепче. Сама по себе почти ничего не даёт, нужна для скрещивания.'),
 'stoner': ('Укурок', 'Сильно снижает интеллект, речь как у укуренного.'),
 'strong': ('Сила', 'Мышцы немного крупнее: сильнее толкает и бьёт.'),
 'swedish': ('Швед', 'Речь превращается в «шведскую» тарабарщину.'),
 'telekinesis': ('Телекинез', 'Можно брать и двигать предметы на расстоянии.'),
 'telepathy': ('Телепатия', 'Способность: мысленно отправить сообщение другому человеку.'),
 'thermal': ('Тепловое зрение', 'Носитель видит тепловые силуэты живых существ сквозь стены.'),
 'thermal/x_ray': ('Рентгеновское зрение', 'Бывший ген рентгена: сейчас даёт то же тепловое зрение, но нестабильнее.'),
 'tongue_spike': ('Язык-шип', 'Способность: выстрелить языком как оружием.'),
 'tongue_spike/chem': ('Хим-шип', 'Способность: выстрелить языком-шипом и перекачать свои реагенты в цель на расстоянии.'),
 'tourettes': ('Синдром Туретта', 'Тики и непроизвольная ругань.'),
 'unintelligible': ('Неразборчивость', 'Речь сильно искажена.'),
 'void': ('Магнит Пустоты', 'Способность: уйти в пустоту. Иногда затягивает туда само по себе.'),
 'wacky': ('Чудик', 'Голос меняется на писклявый клоунский.'),
 'webbing': ('Паутина', 'Способность: плести паутину и проходить сквозь неё.'),
}

ATTRS = ['name', 'desc', 'quality', 'locked', 'difficulty', 'instability', 'blocks', 'text_gain_indication',
         'text_lose_indication', 'power', 'species_allowed', 'conflicts', 'valid_chrom_list', 'stabilizer_coeff',
         'synchronizer_coeff', 'power_coeff', 'energy_coeff', 'health_req', 'limb_req', 'mutator_security_level',
         'mutadone_proof', 'get_chance', 'scrambled']

def parse():
    types, recipes = {}, {}
    for path in included_files():
        if not os.path.exists(path):
            continue
        src = strip_comments(open(path, encoding='utf-8', errors='replace').read())
        cur = None
        for line in src.split('\n'):
            if not line.strip():
                continue
            m = re.match(r'(/datum/(?:mutation/human|generecipe)[\w/]*)\s*$', line)
            if m and not line[0].isspace():
                p = m.group(1)
                cur = types.setdefault(p, {}) if 'mutation' in p else recipes.setdefault(p, {})
                continue
            if not line[0].isspace():
                cur = None
                continue
            if cur is None:
                continue
            m = re.match(r'\t(?:var/)?(?:[\w/]+/)?(\w+)\s*=\s*(.+?)\s*$', line)
            if m and line.startswith('\t') and not line.startswith('\t\t'):
                cur[m.group(1)] = m.group(2)
    return types, recipes

def main():
    load_defines()
    types, recipes = parse()
    base = '/datum/mutation/human'
    defaults = {'name': '"mutation"', 'desc': '"A mutation."', 'difficulty': '8', 'instability': '0', 'blocks': '4',
                'stabilizer_coeff': '1', 'synchronizer_coeff': '-1', 'power_coeff': '-1', 'energy_coeff': '-1'}
    def get(p, k):
        while p.startswith(base):
            if k in types.get(p, {}):
                return types[p][k]
            if p == base:
                break
            p = p.rsplit('/', 1)[0]
        return defaults.get(k)
    muts = []
    for p in sorted(types):
        if p == base or p == base + '/bm':
            continue
        # пропускаем типы-родители без собственного имени
        if 'name' not in types[p] and not any(k in types[p] for k in ('quality', 'desc')):
            continue
        q = resolve(get(p, 'quality') or '')
        locked = (get(p, 'locked') or '').upper() in ('TRUE', '1')
        chrom = list_items(get(p, 'valid_chrom_list') or '')
        coeffs = {k: get(p, k) for k in ('stabilizer_coeff', 'synchronizer_coeff', 'power_coeff', 'energy_coeff')}
        msl = get(p, 'mutator_security_level')
        muts.append({
            'id': p.replace(base + '/', ''),
            'name': clean_html(unq(get(p, 'name') or '')),
            'ru': RU.get(p.replace(base + '/', ''), ('', ''))[0],
            'rdesc': RU.get(p.replace(base + '/', ''), ('', ''))[1],
            'desc': clean_html(unq(get(p, 'desc') or '')),
            'q': {'1': 'pos', '2': 'neg', '4': 'minor'}.get(q, 'none'),
            'locked': locked,
            'diff': int(resolve(get(p, 'difficulty') or '8')),
            'inst': int(resolve(get(p, 'instability') or '0')),
            'blocks': int(resolve(get(p, 'blocks') or '4')),
            'gain': clean_html(unq(get(p, 'text_gain_indication') or '""')),
            'pool': not locked and q in ('1', '2', '4'),
            'lose': clean_html(unq(get(p, 'text_lose_indication') or '""')),
            'spell': bool(get(p, 'power') and get(p, 'power') != 'null'),
            'species': [unq(x) for x in list_items(get(p, 'species_allowed') or '')],
            'conflicts': [x.replace(base + '/', '') for x in list_items(get(p, 'conflicts') or '')],
            'chrom': [unq(x) for x in chrom],
            'coef': [k.split('_')[0] for k, v in coeffs.items() if v and v.strip() != '-1'],
            'sec': resolve(msl) if msl and msl != 'null' else None,
            'health': get(p, 'health_req'),
            'mutadone': (get(p, 'mutadone_proof') or '').upper() == 'TRUE',
        })
    recs = []
    for p, r in sorted(recipes.items()):
        if 'required' not in r or 'result' not in r:
            continue
        req = [x.strip().replace(base + '/', '') for x in unq(r['required']).split(';')]
        if len(req) < 2:
            continue
        res = resolve(r['result']).replace(base + '/', '')
        recs.append({'a': req[0], 'b': req[1], 'r': res})
    ids = {m['id'] for m in muts}
    for r in recs:
        for k in 'abr':
            if r[k] not in ids:
                print('Внимание: рецепт ссылается на неизвестную мутацию', r[k])
    for m in muts:
        if not m['ru']:
            print('Внимание: нет русского названия для', m['id'])
    data = {'mutations': muts, 'recipes': recs,
            'consts': {k: int(resolve(k)) for k in ('DNA_SEQUENCE_LENGTH', 'DNA_MUTATION_BLOCKS')}}
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// Собрано genetics/build_data.py из BlueMoon-Station: мутации и рецепты скрещивания\n')
        f.write('window.GEN_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'Мутаций: {len(muts)}, рецептов: {len(recs)} -> {OUT}')

main()
