"""Разбирает выгрузку «Нормы рабочих процедур» (markdown из Google Docs) в avd/nrp.js для панели АВД.
Запуск: python parse_nrp.py <НРП.md> nrp.js — документ: «Файл → Скачать → Markdown» в Google Docs."""
import json
import re
import sys

src, out = sys.argv[1], sys.argv[2]
lines = open(src, encoding="utf-8").read().split("\n")

DEPTS = [  # (ключ, начало заголовка H1, название, короткое)
    ("alert", "НРП Уровня тревоги", "Уровни тревоги", "Тревога"),
    ("alert", "Чрезвычайная ситуация", None, None),
    ("command", "НРП Командующего состава", "Командование", "Командование"),
    ("sec", "НРП Отдела Службы Безопасности", "Служба безопасности", "СБ"),
    ("law", "НРП применения Космического Закона", "Применение КЗ", "КЗ"),
    ("legal", "НРП Юридический отдел", "Юридический отдел", "Юр. отдел"),
    ("eng", "НРП Инженерный отдел", "Инженерный отдел", "Инженеры"),
    ("eng", "НРП Строительства", None, None),
    ("sci", "НРП Отдел Исследований", "Отдел исследований и разработок", "ОИР"),
    ("srv", "НРП Сервисный отдел", "Сервисный отдел", "Сервис"),
    ("sup", "НРП Отдел Снабжения", "Отдел снабжения", "Снабжение"),
    ("med", "НРП Медицинский Отдел", "Медицинский отдел", "Медотдел"),
    (None, "Политика Антагонистов", None, None),
    (None, "Глоссарий", None, None),
    ("ai", "Что я должен делать", "Силиконы и ИИ", "Силиконы"),
    ("ai", "Таблица Взаимодействия", None, None),
    ("ai", "Политика Силиконов", None, None),
]


# Заголовки должностей в документе стоят в родительном падеже («НРП Бармена») — в панели и рапорте нужен именительный
NOM = {
    "Капитана": "Капитан", "Офицера Мостика": "Офицер Мостика", "Офицера “Синий Щит”": "Офицер «Синий Щит»",
    "Главы Службы Безопасности": "Глава Службы Безопасности", "Главного Инженера": "Главный Инженер",
    "Директора ОИР": "Директор ОИР", "Главы Персонала": "Глава Персонала", "Главного Врача": "Главный Врач",
    "Квартирмейстера": "Квартирмейстер", "Представителя ПАКТа": "Представитель Пакта", "Представителя Пакта": "Представитель Пакта",
    "применения силы": "Применение силы", "Общее положение отдела Службы безопасности": "Общие положения",
    "Смотрителя": "Смотритель", "Бриг Медика": "Бриг-медик", "Детектива": "Детектив",
    "Офицера Службы Безопасности": "Офицер Службы Безопасности", "Кадета, Миротворца и так далее": "Кадет, Миротворец и др.",
    "Нормы Рабочих Процедур посадки в ИВС и в Пермабриг": "Посадка в ИВС и пермабриг",
    "Политика ношения оружия:": "Политика ношения оружия", "Агента внутренних дел": "Агент Внутренних Дел",
    "Общие положения для Инженерного отдела": "Общие положения", "НРП Строительства (WIP)": "Строительство (WIP)",
    "Инженера": "Инженер", "Атмосферного техника": "Атмосферный техник", "Стажёров Инженерного отдела": "Стажёр",
    "Общие положения Отдела Исследований и Разработок": "Общие положения", "Корпуса Ксенобиологии": "Ксенобиолог",
    "Экспедиторского корпуса": "Экспедитор", "Робототехнического корпуса": "Робототехник", "Химического корпуса": "Химик",
    "Младших научных сотрудников": "Младший научный сотрудник", "Повара": "Повар", "Бармена": "Бармен",
    "Ботанического Корпуса": "Ботаник", "Мима": "Мим", "Клоуна": "Клоун", "Священника": "Священник", "Уборщика": "Уборщик",
    "Библиотекаря": "Библиотекарь", "Охраны Сервиса": "Охрана Сервиса", "Общие положения Отдела Снабжения": "Общие положения",
    "Грузчика": "Грузчик", "Шахтёрского Корпуса": "Шахтёр", "Общие положения Медицинского отдела": "Общие положения",
    "Терапевтического корпуса": "Врач", "Психотерапевтического корпуса": "Психотерапевт",
    "Корпуса экстренной помощи": "Парамедик", "Генетического корпуса": "Генетик", "Корпуса Вирусологии": "Вирусолог",
    "Политика проведения хирургической Пацификации": "Хирургическая пацификация",
}


def clean(s):
    s = s.replace("&#10;", " ").replace("<!-- end list -->", "")
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
    s = s.replace("\\*", "").replace("*", "").replace("\\", "")
    return re.sub(r"\s+", " ", s).strip()


def kind(h):
    h = h.lower()
    if re.search(r"запрещ|не имеет права|не вправе|не может|не должен|не допуска", h):
        return "ban"
    if re.search(r"обязан|должен|обязуется|следует", h):
        return "duty"
    if re.search(r"имеет право|вправе|может|разреш|право", h):
        return "right"
    return "rule"


rev = re.search(r"редакцией от (\d{1,2}\.\d{1,2}\.\d{4})", "\n".join(lines[:40]))
data = {"rev": "ред. " + rev.group(1) if rev else "", "depts": []}
dept = role = group = None
pending_role = False
last = None


def new_role(title):
    global role, group, last
    role = {"t": NOM.get(title, title), "intro": [], "groups": [], "tables": []}
    dept["roles"].append(role)
    group = last = None


def new_group(title, k=None):
    global group, last
    if role is None:
        new_role("Общие положения")
    group = {"t": title, "k": k or kind(title), "items": []}
    role["groups"].append(group)
    last = None


table = None
for raw in lines + [""]:
    line = raw.rstrip()
    if line.startswith("|"):
        cells = [clean(c) for c in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-+:?", c) or not c for c in cells):
            continue
        if dept and role is not None:
            if table is None:
                table = []
                role["tables"].append(table)
            table.append(cells)
        continue
    table = None
    m = re.match(r"^(#{1,4})\s*(.*)$", line)
    if m:
        level, text = len(m.group(1)), clean(m.group(2))
        if level == 1:
            if not text or len(text) > 80:
                continue
            hit = next((d for d in DEPTS if text.startswith(d[1])), None)
            if hit:
                key = hit[0]
                if key is None:
                    dept = None
                    continue
                found = next((d for d in data["depts"] if d["id"] == key), None)
                if not found:
                    found = {"id": key, "t": hit[2], "s": hit[3], "roles": [], "intro": []}
                    data["depts"].append(found)
                dept = found
                role = group = None
                if hit[2] is None:  # раздел, приклеенный к отделу: своя «должность»
                    new_role(text)
            continue
        if dept is None:
            continue
        if level == 2:
            if not text:
                pending_role = True
                continue
            if len(text) > 90:  # абзац, ошибочно оформленный заголовком
                (role["intro"] if role else dept["intro"]).append(text)
                continue
            if text == "Условия" and role is not None:  # у кодов тревоги «Условия» — H2 внутри кода
                new_group(text)
                continue
            new_role(re.sub(r"^НРП\s+", "", text))
        else:
            new_group(text.rstrip(":"))
        continue
    if dept is None:
        continue
    text = clean(line)
    if not text:
        continue
    if pending_role:
        pending_role = False
        new_role(re.sub(r"^НРП\s+", "", text))
        continue
    li = re.match(r"^\s*[-•]\s+(.*)$", line)
    num = re.match(r"^\s*\d+\.\s+(.*)$", line)
    body = clean((li or num).group(1)) if (li or num) else text
    is_head = body.endswith(":") and len(body) < 90 and re.search(
        r"обязан|прав|запрещ|вправе|долж|следует|может|разреш", body.lower())
    if is_head and not li:
        new_group(body.rstrip(":").strip())
        continue
    if li or (num and len(body) > 60):
        if group is None:
            new_group("Положения", "rule")
        last = {"t": body}
        group["items"].append(last)
        continue
    if last is not None and (re.match(r"^(Исключ|Примечани|Однако|При этом|В этом случае|В случае)", body) or len(body) < 40):
        last["t"] += " " + body
        continue
    if role is None:
        dept["intro"].append(body)
    elif group is None or not group["items"]:
        role["intro"].append(body)
    else:  # отдельный абзац среди пунктов — тоже правило
        last = {"t": body}
        group["items"].append(last)

# Номера пунктов: отдел.должность.группа.пункт — для ссылок в рапорте
for d in data["depts"]:
    d["roles"] = [r for r in d["roles"] if r["groups"] or r["intro"] or r["tables"]]
    for ri, r in enumerate(d["roles"], 1):
        r["groups"] = [g for g in r["groups"] if g["items"]]
        n = 0
        for g in r["groups"]:
            for it in g["items"]:
                n += 1
                it["n"] = f"{ri}.{n}"

body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
with open(out, "w", encoding="utf-8") as f:
    f.write("// Сгенерировано parse_nrp.py из документа «Нормы рабочих процедур» — руками не править\n")
    f.write("window.NRP=" + body + ";\n")
for d in data["depts"]:
    print(f"== {d['id']} {d['t']}  intro={len(d['intro'])}")
    for r in d["roles"]:
        gs = ", ".join(f"{g['k']}:{len(g['items'])}" for g in r["groups"])
        print(f"   {r['t'][:50]:50} intro={len(r['intro'])} tables={len(r['tables'])} [{gs}]")
