# Сборка Пульт.apk без Gradle и Android Studio: aapt2 → javac → d8 → zipalign → apksigner.
# Инструменты — портативные, в android\.tools (JDK 17, Android SDK: build-tools 34, platform android-34).
# Перед сборкой забирает свежие версии всех шести приложений (sync-apps.ps1).
# Запуск: powershell -ExecutionPolicy Bypass -File android\build.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$sync = Join-Path $root 'sync-apps.ps1' # по настоящему пути: он ищет приложения в соседних папках
# aapt2 и d8 не понимают кириллицу в путях («Пульт») — работаем через ASCII-ссылку на папку проекта.
# Ссылка постоянная и переиспользуется (удалять её через Remove-Item нельзя — удалит содержимое).
if ($root -match '[^\x00-\x7F]') {
    $link = Join-Path $env:LOCALAPPDATA 'pult-build-root'
    $cur = Get-Item $link -Force -ErrorAction SilentlyContinue
    if ($cur -and "$($cur.Target)" -ne $root) { [IO.Directory]::Delete($link) } # папку проекта переместили: снимаем только ссылку
    if (-not (Get-Item $link -Force -ErrorAction SilentlyContinue)) { New-Item -ItemType Junction -Path $link -Target $root | Out-Null }
    $root = $link
}
$android = Join-Path $root 'android'
$tools = Join-Path $android '.tools'
$jdk = (Get-ChildItem $tools -Directory -Filter 'jdk-*' | Select-Object -First 1).FullName
$sdk = Join-Path $tools 'sdk'
$bt = Join-Path $sdk 'build-tools\34.0.0'
$androidJar = Join-Path $sdk 'platforms\android-34\android.jar'
$out = Join-Path $root 'Пульт.apk'
$build = Join-Path $android 'build'
if (-not $jdk -or -not (Test-Path $bt) -or -not (Test-Path $androidJar)) { throw 'Нет инструментов в android\.tools — см. README, раздел «Android»' }
$env:JAVA_HOME = $jdk
$env:PATH = "$jdk\bin;$env:PATH"

# Инструменты вызываются напрямую (через функцию PowerShell портит аргументы с «-» и «:»), затем Check
function Check($name) { if ($LASTEXITCODE -ne 0) { throw "$name завершился с кодом $LASTEXITCODE" } }

& $sync
if (Test-Path $build) { Remove-Item $build -Recurse -Force }
New-Item -ItemType Directory -Force "$build\assets", "$build\classes", "$build\dex" | Out-Null
Copy-Item (Join-Path $root 'web') "$build\assets\web" -Recurse

# Значок: шесть дуг цветов приложений на тёмном круге — как в меню и у Пульт.exe
Add-Type -AssemblyName System.Drawing
$colors = '#3fa66b', '#d63c45', '#3a7be0', '#e2b33a', '#e07a3f', '#9a6ad6'
$span = 360 / $colors.Count
$densities = @{ mdpi = 48; hdpi = 72; xhdpi = 96; xxhdpi = 144; xxxhdpi = 192 }
foreach ($d in $densities.Keys) {
    $s = $densities[$d]
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'
    $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 18, 21, 27))
    $g.FillEllipse($bg, 0, 0, $s - 1, $s - 1); $bg.Dispose()
    $w = $s * 0.11
    $m = $s * 0.2
    $rect = New-Object System.Drawing.RectangleF $m, $m, ($s - 2 * $m), ($s - 2 * $m)
    for ($i = 0; $i -lt $colors.Count; $i++) {
        $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($colors[$i])), $w
        $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
        $g.DrawArc($pen, $rect, -90 - $span / 2 + $i * $span + 12, $span - 24)
        $pen.Dispose()
    }
    $dot = $s * 0.14
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 150, 160, 178))
    $g.FillEllipse($brush, ($s - $dot) / 2, ($s - $dot) / 2, $dot, $dot)
    $brush.Dispose(); $g.Dispose()
    $dir = "$build\res\mipmap-$d"
    New-Item -ItemType Directory -Force $dir | Out-Null
    $bmp.Save("$dir\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}

# Ресурсы и манифест; assets\web — страницы Пульта
$version = [int](Get-Date -Format 'yyMMddHH')
& "$bt\aapt2.exe" compile --dir "$build\res" -o "$build\res.zip"; Check 'aapt2.exe'
& "$bt\aapt2.exe" link -o "$build\base.apk" -I $androidJar --manifest (Join-Path $android 'AndroidManifest.xml') `
    --min-sdk-version 24 --target-sdk-version 34 `
    --version-code $version --version-name '0.0.3' "$build\res.zip"; Check 'aapt2 link'
# Страницы добавляет jar: aapt2 -A на Windows пишет пути через «\», и Android их не находит
& "$jdk\bin\jar.exe" --update --file "$build\base.apk" --no-manifest --no-compress -C $build assets; Check 'jar'

# Код
$java = Get-ChildItem (Join-Path $android 'src') -Recurse -Filter *.java | ForEach-Object FullName
& "$jdk\bin\javac.exe" -encoding UTF-8 -source 11 -target 11 -nowarn -classpath $androidJar -d "$build\classes" $java; Check 'javac.exe'
$classes = Get-ChildItem "$build\classes" -Recurse -Filter *.class | ForEach-Object FullName
& "$bt\d8.bat" --release --min-api 24 --lib $androidJar --output "$build\dex" $classes; Check 'd8.bat'
Push-Location "$build\dex"
try { & "$bt\aapt.exe" add "$build\base.apk" classes.dex | Out-Null; Check 'aapt.exe' } finally { Pop-Location }

# Подпись. Ключ создаётся один раз: обновить установленный Пульт можно только APK с тем же ключом
$ks = Join-Path $android 'pult-release.jks'
$pwFile = Join-Path $android 'pult-release.password.txt'
if (-not (Test-Path $ks)) {
    $pw = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
    Set-Content $pwFile $pw -NoNewline -Encoding ascii
    & "$jdk\bin\keytool.exe" -genkeypair -keystore $ks -alias pult -keyalg RSA -keysize 2048 -validity 10000 `
        -storepass $pw -keypass $pw -dname 'CN=Pult, O=Sla2her for BlueMoon'; Check 'keytool'
}
$pw = (Get-Content $pwFile -Raw).Trim()
& "$bt\zipalign.exe" -p -f 4 "$build\base.apk" "$build\aligned.apk"; Check 'zipalign.exe'
& "$bt\apksigner.bat" sign --ks $ks --ks-key-alias pult --ks-pass "pass:$pw" --key-pass "pass:$pw" --out $out "$build\aligned.apk"; Check 'apksigner.bat'
& "$bt\apksigner.bat" verify $out; Check 'apksigner.bat'
"Готово: $(Join-Path (Split-Path $PSScriptRoot -Parent) 'Пульт.apk') ({0:N2} МБ)" -f ((Get-Item $out).Length / 1MB)
