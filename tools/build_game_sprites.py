# Спрайты для игр Пульта («Теплица» в Ботанике, «Пациент на столе» в Медбее, иконки «Смены» на Кухне)
# из файлов иконок BlueMoon-Station. Запуск: python tools/build_game_sprites.py <путь к клону BlueMoon-Station>
# Нужен Pillow. Берётся первый кадр первого направления каждого состояния .dmi.
import sys, os, re, io, json, glob, base64
from PIL import Image, ImageChops
ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def parse(globs):
    T = {}
    for g in globs:
        for f in glob.glob(ROOT + g, recursive=True):
            cur = None
            for line in open(f, encoding='utf8', errors='ignore'):
                l = line.rstrip('\n')
                if re.match(r'^/[\w/]+\s*$', l): cur = l.strip(); T.setdefault(cur, {}); continue
                if re.match(r'^\S', l): cur = None; continue
                if cur:
                    m = re.match(r'^\t(\w+)\s*=\s*(.+?)\s*(//.*)?$', l)
                    if m: T[cur][m.group(1)] = m.group(2).strip()
    return T
def look(T, p, k):
    while p:
        if p in T and k in T[p]: return T[p][k]
        p = p[:p.rfind('/')] if p.count('/') > 1 else ''
    return None
_dmi = {}
def dmi(path):
    if path in _dmi: return _dmi[path]
    im = Image.open(path); desc = im.info.get('Description', '')
    w = int(re.search(r'width = (\d+)', desc).group(1)); h = int(re.search(r'height = (\d+)', desc).group(1))
    st = {}; idx = 0
    for m in re.finditer(r'state = "(.*?)"\n((?:\t.*\n?)*)', desc):
        body = m.group(2); d = int(re.search(r'dirs = (\d+)', body).group(1)); fr = int(re.search(r'frames = (\d+)', body).group(1))
        st.setdefault(m.group(1), (idx, d, fr)); idx += d * fr
    _dmi[path] = (im.convert('RGBA'), w, h, st); return _dmi[path]
def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
def sprite(path, state, img=False):
    if not path or not state: return None
    fp = os.path.join(ROOT, path)
    if not os.path.exists(fp): return None
    im, w, h, st = dmi(fp)
    if state not in st: return None
    i = st[state][0]; cols = im.width // w
    c = im.crop(((i % cols) * w, (i // cols) * h, (i % cols) * w + w, (i // cols) * h + h))
    return c if img else uri(c)

def farm():
    T = parse(['/code/modules/hydroponics/**/*.dm', '/modular_bluemoon/**/hydroponics/**/*.dm'])
    s = open(os.path.join(HERE, 'botany/data.js'), encoding='utf8').read(); B = json.loads(s[s.index('{'):s.rindex('}') + 1])['plants']
    base = ['tomato', 'wheat', 'potato', 'corn', 'banana', 'apple', 'cabbage', 'chili', 'carrot', 'grape', 'sugarcane', 'ambrosia', 'berry', 'plump', 'eggplant', 'watermelon', 'pumpkin', 'onion', 'cocoapod']
    allp = set(b for b in base if b in B)
    for b in list(allp): allp |= set(m for m in B[b]['mut'] if m in B)
    out = {'plants': {}, 'ui': {}}
    for pid in sorted(allp):
        sp = '/obj/item/seeds/' + pid; g = lambda k: (look(T, sp, k) or '').strip('\'"')
        species = g('species'); gi = g('growing_icon') or 'icons/obj/hydroponics/growing.dmi'
        ig = g('icon_grow') or species + '-grow'; idd = g('icon_dead') or species + '-dead'; ih = g('icon_harvest')
        stages = int(g('growthstages') or B[pid]['gro'] or 6); p = B[pid]; fungal = 'plant_type/fungal_metabolism' in p['genes']
        grow = [sprite(gi, ig + str(i)) for i in range(1, stages + 1)]
        harv = sprite(gi, ih) if ih else (None if fungal else sprite(gi, species + '-harvest'))
        dead = sprite(gi, idd); prod = sprite(p['icon'], p['istate']); seed = sprite(p['sicon'], p['sstate'])
        if None in grow or not dead or not prod: continue
        out['plants'][pid] = {'grow': grow, 'harv': harv or grow[-1], 'dead': dead, 'prod': prod, 'seed': seed}
    E = 'icons/obj/hydroponics/equipment.dmi'
    ui = {'tray': (E, 'hydrotray3'), 'lowwater': (E, 'over_lowwater3'), 'lownutri': (E, 'over_lownutri3'), 'lowhealth': (E, 'over_lowhealth3'), 'alert': (E, 'over_alert3'), 'harvest': (E, 'over_harvest3'),
          'pestspray': (E, 'pestspray'), 'weedspray': (E, 'weedspray'), 'plantbag': (E, 'plantbag'), 'cultivator': ('icons/obj/items_and_weapons.dmi', 'cultivator'), 'hatchet': ('icons/obj/items_and_weapons.dmi', 'hatchet'),
          'bucket': ('icons/obj/janitor.dmi', 'bucket_wooden'), 'ez': ('icons/obj/chemical.dmi', 'bottle16'), 'l4z': ('icons/obj/chemical.dmi', 'bottle18'), 'rh': ('icons/obj/chemical.dmi', 'bottle15'), 'analyzer': ('icons/obj/device.dmi', 'hydro'), 'sextractor': (E, 'sextractor')}
    for k, (f, st) in ui.items(): out['ui'][k] = sprite(f, st)
    out['weeds'] = [x for x in (sprite('icons/obj/hydroponics/growing_flowers.dmi', 'starthistle-grow%d' % i) for i in range(1, 7)) if x]
    open(os.path.join(HERE, 'botany/farm-sprites.js'), 'w').write('// Спрайты BlueMoon для «Теплицы»: icons/obj/hydroponics/*.dmi и др., первый кадр. Сгенерировано скриптом, руками не править.\nwindow.FARM_SPRITES=' + json.dumps(out, separators=(',', ':')) + ';\n')

def body(skin):
    G = 'icons/mob/human_parts_greyscale.dmi'; b = Image.new('RGBA', (32, 32))
    for pp in ['human_r_leg_behind', 'human_l_leg_behind', 'human_chest_m', 'human_r_leg_front', 'human_l_leg_front', 'human_head_m', 'human_l_arm', 'human_r_arm', 'human_l_hand', 'human_r_hand']:
        x = sprite(G, pp, img=True)
        if x: b.alpha_composite(x)
    r, g, bb, a = b.split(); rgb = ImageChops.multiply(Image.merge('RGB', (r, g, bb)), Image.new('RGB', b.size, skin))
    o = rgb.convert('RGBA'); o.putalpha(a); return uri(o)
def med():
    o = {'body': {k: body(c) for k, c in [('light', (245, 208, 180)), ('tan', (214, 160, 118)), ('dark', (140, 95, 66))]}, 'dam': {}, 'doll': {}, 'ui': {}}
    parts = ['head', 'chest', 'l_arm', 'r_arm', 'l_leg', 'r_leg']
    for p in parts:
        for i in range(1, 4):
            for st in ('%d0' % i, '0%d' % i):
                s = sprite('icons/mob/dam_mob.dmi', 'human_%s_%s' % (p, st))
                if s: o['dam']['%s_%s' % (p, st)] = s
        for i in range(1, 8): o['doll'][p + str(i)] = sprite('icons/mob/screen_gen.dmi', p + str(i))
    o['doll']['overlay'] = sprite('icons/mob/screen_gen.dmi', 'healthdoll_OVERLAY'); o['doll']['dead'] = sprite('icons/mob/screen_gen.dmi', 'healthdoll_DEAD')
    o['ekg'] = [sprite('icons/mob/screen_gen.dmi', 'health%d' % i) for i in range(8)]
    U = {'optable': ('icons/obj/surgery.dmi', 'optable'), 'analyzer': ('icons/obj/device.dmi', 'health_adv'), 'syringe': ('icons/obj/syringe.dmi', '15'), 'syringe0': ('icons/obj/syringe.dmi', '0'),
         'brute': ('icons/obj/medical/stack_medical.dmi', 'brutepack'), 'ointment': ('icons/obj/medical/stack_medical.dmi', 'ointment'), 'gauze': ('icons/obj/medical/stack_medical.dmi', 'gauze'),
         'medipen': ('icons/obj/syringe.dmi', 'medipen'), 'bottle': ('icons/obj/chemical.dmi', 'bottle')}
    for k, (f, s) in U.items(): o['ui'][k] = sprite(f, s)
    for k, s in {'pill_bic': 'pill4', 'pill_kel': 'pill12', 'pill_tox': 'pill17', 'pill_dex': 'pill16', 'pill_tri': 'pill9', 'pill_epi': 'pill5'}.items():
        im = sprite('icons/obj/chemical.dmi', s, img=True); c = im.crop(im.getbbox()); n = max(c.size) + 4
        sq = Image.new('RGBA', (n, n)); sq.paste(c, ((n - c.size[0]) // 2, (n - c.size[1]) // 2)); o['ui'][k] = uri(sq)
    open(os.path.join(HERE, 'medbay/sprites.js'), 'w').write('// Спрайты BlueMoon для «Пациента на столе»: human_parts_greyscale, dam_mob, screen_gen (кукла здоровья и ЭКГ), surgery, stack_medical, syringe, chemical. Сгенерировано скриптом, руками не править.\nwindow.MED_SPRITES=' + json.dumps(o, separators=(',', ':')) + ';\n')

if __name__ == '__main__':
    farm(); med(); print('ok')
