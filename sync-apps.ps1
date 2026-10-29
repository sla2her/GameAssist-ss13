# Копирует свежие сборки трёх приложений в web\apps\ (оттуда их берёт Пульт и его сборка).
# Запуск: powershell -ExecutionPolicy Bypass -File sync-apps.ps1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$clod = Split-Path $root -Parent
$apps = Join-Path $root 'web\apps'

function Reset-Dir($path) {
    if (Test-Path $path) { Remove-Item $path -Recurse -Force }
    New-Item -ItemType Directory -Force $path | Out-Null
}

# Алхимик — один файл со встроенной базой
$dst = Join-Path $apps 'alchimik'; Reset-Dir $dst
Copy-Item (Join-Path $clod 'Алхимик\Алхимик.html') (Join-Path $dst 'index.html')

# Терминал Брига — подготовленная prepare.py папка app\ (страница + локальные шрифты)
$dst = Join-Path $apps 'brig'; Reset-Dir $dst
Copy-Item (Join-Path $clod 'brig-terminal\app\*') $dst -Recurse

# Папирус — страница, стили, скрипт
$src = Join-Path $clod 'Папирус'
$dst = Join-Path $apps 'papirus'; Reset-Dir $dst
Copy-Item (Join-Path $src 'index.html') $dst
Copy-Item (Join-Path $src 'css') $dst -Recurse
Copy-Item (Join-Path $src 'js') $dst -Recurse

# Инженер — веб-версия оверлея живёт в Пульте (engineer\), инструкции берём из engineer-helper\guides.json
$dst = Join-Path $apps 'engineer'; Reset-Dir $dst
Copy-Item (Join-Path $root 'engineer\index.html') $dst
Copy-Item (Join-Path $clod 'engineer-helper\guides.json') $dst

# Кухня и бар — один файл со встроенной базой рецептов
$dst = Join-Path $apps 'kitchen'; Reset-Dir $dst
Copy-Item (Join-Path $clod 'ss13-kitchen\BlueMoon-Kitchen.html') (Join-Path $dst 'index.html')

# Химзавод — один файл со встроенной базой реакций
$dst = Join-Path $apps 'himzavod'; Reset-Dir $dst
Copy-Item (Join-Path $clod 'Химзавод\Химзавод.html') (Join-Path $dst 'index.html')

# Персонаж — редактор персонажа: один файл со встроенными данными и спрайтами билда
$dst = Join-Path $apps 'character'; Reset-Dir $dst
Copy-Item (Join-Path $clod 'Персонаж\Персонаж.html') (Join-Path $dst 'index.html')

# Симулятор Схем — конструктор схем живёт в Пульте (circuits\), каталог компонентов — circuits\catalog.js
$dst = Join-Path $apps 'circuits'; Reset-Dir $dst
Copy-Item (Join-Path $root 'circuits\*') $dst -Exclude '*.mjs'

# Панель АВД — живёт в Пульте (avd\), база НРП — avd\nrp.js (собирает avd\parse_nrp.py)
$dst = Join-Path $apps 'avd'; Reset-Dir $dst
Copy-Item (Join-Path $root 'avd\index.html'), (Join-Path $root 'avd\nrp.js') $dst

# Панель Командования — живёт в Пульте (command\), базу НРП берёт у Панели АВД (..\avd\nrp.js)
$dst = Join-Path $apps 'command'; Reset-Dir $dst
Copy-Item (Join-Path $root 'command\index.html') $dst

"Приложения скопированы в $apps"
