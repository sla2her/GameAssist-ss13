// Пульт — одно окно для Алхимика, Терминала Брига и Папируса.
// WinForms + системный движок WebView2 (Edge). Страницы всех трёх приложений и оболочки вшиты
// в exe и отдаются окну прямо из памяти. На диск (%LOCALAPPDATA%\Pult) пишутся только загрузчик
// WebView2, данные приложений и положение окна в каждом из режимов.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Пульт")]
[assembly: AssemblyProduct("Пульт — Алхимик, Терминал Брига, Папирус")]
[assembly: AssemblyCompany("Sla2her")]
[assembly: AssemblyCopyright("Made by: Sla2her for BlueMoon")]
[assembly: AssemblyVersion("0.0.5.0")]
[assembly: AssemblyFileVersion("0.0.5.0")]

static class Program
{
    public static readonly string BaseDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Pult");

    [STAThread]
    static void Main()
    {
        // Управляемые DLL WebView2 грузим прямо из ресурсов exe
        AppDomain.CurrentDomain.AssemblyResolve += (s, e) =>
        {
            byte[] bytes = Resource(new AssemblyName(e.Name).Name + ".dll");
            return bytes == null ? null : Assembly.Load(bytes);
        };
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Run();
    }

    // Отдельный метод: типы WebView2 подтягиваются только после подписки на AssemblyResolve
    [MethodImpl(MethodImplOptions.NoInlining)]
    static void Run()
    {
        Application.Run(new MainForm());
    }

    public static byte[] Resource(string name)
    {
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
        {
            if (s == null) return null;
            var ms = new MemoryStream();
            s.CopyTo(ms);
            return ms.ToArray();
        }
    }

    public static void Extract(string resource, string path)
    {
        byte[] data = Resource(resource);
        if (data == null) throw new FileNotFoundException("В exe нет ресурса " + resource);
        Directory.CreateDirectory(Path.GetDirectoryName(path));
        if (File.Exists(path) && new FileInfo(path).Length == data.Length) return;
        try { File.WriteAllBytes(path, data); }
        catch (IOException) { if (!File.Exists(path)) throw; } // файл занят вторым окном — оставляем как есть
    }
}

// Настройки окна: режим, «поверх всех окон» и положение для каждого режима (key=value в window.txt)
class WindowPrefs
{
    readonly string file = Path.Combine(Program.BaseDir, "window.txt");
    readonly Dictionary<string, string> v = new Dictionary<string, string>();

    public WindowPrefs()
    {
        try
        {
            if (File.Exists(file))
                foreach (string line in File.ReadAllLines(file))
                {
                    int i = line.IndexOf('=');
                    if (i > 0) v[line.Substring(0, i)] = line.Substring(i + 1);
                }
        }
        catch { }
    }

    public string this[string key]
    {
        get { string s; return v.TryGetValue(key, out s) ? s : null; }
        set { v[key] = value; }
    }

    public Rectangle? Rect(string key)
    {
        string s = this[key];
        if (s == null) return null;
        string[] p = s.Split(',');
        int x, y, w, h;
        if (p.Length != 4 || !int.TryParse(p[0], out x) || !int.TryParse(p[1], out y) ||
            !int.TryParse(p[2], out w) || !int.TryParse(p[3], out h)) return null;
        return new Rectangle(x, y, w, h);
    }

    public void SetRect(string key, Rectangle r) { this[key] = r.X + "," + r.Y + "," + r.Width + "," + r.Height; }

    public void Save()
    {
        try
        {
            Directory.CreateDirectory(Program.BaseDir);
            var lines = new List<string>();
            foreach (var kv in v) lines.Add(kv.Key + "=" + kv.Value);
            File.WriteAllLines(file, lines.ToArray());
        }
        catch { }
    }
}

class MainForm : Form
{
    const string Host = "pult.app";
    const string Title = "Пульт";

    static readonly Size CompactMin = new Size(360, 480);
    static readonly Size ExpandedMin = new Size(1000, 600);

    [DllImport("dwmapi.dll")]
    static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

    readonly WebView2 web;
    readonly WindowPrefs state = new WindowPrefs();
    bool compact;
    bool dark = true;

    public MainForm()
    {
        Text = Title;
        StartPosition = FormStartPosition.Manual;
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        dark = state["theme"] != "light";
        BackColor = Color.Black; // чёрный GDI-фон при включённой альфе прозрачен; фон рисует страница

        compact = state["mode"] == "compact";
        PlaceWindow();
        if (state["pin"] == "1") TopMost = true;

        web = new WebView2();
        web.Dock = DockStyle.Fill;
        web.DefaultBackgroundColor = Color.Transparent;
        Controls.Add(web);

        HandleCreated += (s, e) => { ApplyCaption(); EnableAlpha(); };
        Load += async (s, e) => await InitAsync();
    }

    // ---------- Режимы окна ----------

    string Key { get { return compact ? "compact" : "expanded"; } }

    // Ставит окно туда, где оно было в этом режиме; в первый раз — компактное у правого края экрана,
    // расширенное по центру.
    void PlaceWindow()
    {
        MinimumSize = compact ? CompactMin : ExpandedMin;
        Rectangle wa = Screen.PrimaryScreen.WorkingArea;
        Rectangle? saved = state.Rect(Key);
        Rectangle r;
        if (saved.HasValue && OnScreen(saved.Value)) r = saved.Value;
        else if (compact)
        {
            int h = Math.Min(820, wa.Height - 60);
            r = new Rectangle(wa.Right - 460 - 20, wa.Top + (wa.Height - h) / 2, 460, h);
        }
        else
        {
            int w = Math.Min(1440, wa.Width - 40), h = Math.Min(920, wa.Height - 40);
            r = new Rectangle(wa.Left + (wa.Width - w) / 2, wa.Top + (wa.Height - h) / 2, w, h);
        }
        WindowState = FormWindowState.Normal;
        Bounds = r;
        if (!compact && state["expandedMax"] == "1") WindowState = FormWindowState.Maximized;
    }

    static bool OnScreen(Rectangle r)
    {
        foreach (Screen s in Screen.AllScreens)
        {
            Rectangle i = Rectangle.Intersect(s.WorkingArea, r);
            if (i.Width >= 120 && i.Height >= 80) return true;
        }
        return false;
    }

    void RememberBounds()
    {
        if (WindowState == FormWindowState.Minimized) return;
        if (!compact) state["expandedMax"] = WindowState == FormWindowState.Maximized ? "1" : "0";
        state.SetRect(Key, WindowState == FormWindowState.Normal ? Bounds : RestoreBounds);
    }

    void SetMode(bool isCompact)
    {
        if (isCompact != compact)
        {
            RememberBounds();
            compact = isCompact;
            SuspendLayout();
            PlaceWindow();
            ResumeLayout();
            state["mode"] = Key;
            state.Save();
        }
        PostState();
    }

    void SetPinned(bool on)
    {
        TopMost = on;
        state["pin"] = on ? "1" : "0";
        state.Save();
        PostState();
    }

    void PostState()
    {
        if (web.CoreWebView2 == null) return;
        web.CoreWebView2.PostWebMessageAsJson(
            "{\"mode\":\"" + Key + "\",\"pinned\":" + (TopMost ? "true" : "false") + "}");
    }

    // ---------- Прозрачный фон ----------
    // Окно учитывает альфа-канал своих пикселей (как прозрачные окна Tauri): WebView2 рисует без
    // подложки, а насколько прозрачен фон, решает страница — кнопки и текст остаются плотными.

    [StructLayout(LayoutKind.Sequential)]
    struct DWM_BLURBEHIND { public int dwFlags; public bool fEnable; public IntPtr hRgnBlur; public bool fTransitionOnMaximized; }
    [DllImport("dwmapi.dll")]
    static extern int DwmEnableBlurBehindWindow(IntPtr hwnd, ref DWM_BLURBEHIND bb);
    [DllImport("gdi32.dll")]
    static extern IntPtr CreateRectRgn(int l, int t, int r, int b);
    [DllImport("gdi32.dll")]
    static extern bool DeleteObject(IntPtr h);

    void EnableAlpha()
    {
        try
        {
            IntPtr rgn = CreateRectRgn(0, 0, -1, -1); // пустая область: без размытия, только альфа
            var bb = new DWM_BLURBEHIND { dwFlags = 1 | 2, fEnable = true, hRgnBlur = rgn }; // DWM_BB_ENABLE | DWM_BB_BLURREGION
            DwmEnableBlurBehindWindow(Handle, ref bb);
            DeleteObject(rgn);
        }
        catch { }
    }

    // ---------- Хоткеи Инженера поверх игры ----------
    // Инженер присылает «next=F8;prev=F7;…» из guides.json. Клавиши занимаются глобально (как в
    // engineer-helper): работают, пока активно окно игры, и пропадают для неё, пока Пульт запущен.

    [DllImport("user32.dll")]
    static extern bool RegisterHotKey(IntPtr hWnd, int id, uint mods, uint vk);
    [DllImport("user32.dll")]
    static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    [DllImport("user32.dll")]
    static extern bool ShowWindow(IntPtr hWnd, int cmd);

    const int WM_HOTKEY = 0x0312;
    const uint MOD_NOREPEAT = 0x4000;
    readonly Dictionary<int, string> hotkeys = new Dictionary<int, string>();
    readonly List<string> failedHotkeys = new List<string>();
    string hotkeySpec;
    bool hiddenByHotkey;

    void SetHotkeys(string spec)
    {
        if (spec != hotkeySpec)
        {
            hotkeySpec = spec;
            foreach (int id in hotkeys.Keys) UnregisterHotKey(Handle, id);
            hotkeys.Clear();
            failedHotkeys.Clear();
            int next = 1;
            foreach (string pair in spec.Split(';'))
            {
                int i = pair.IndexOf('=');
                if (i <= 0) continue;
                string action = pair.Substring(0, i), key = pair.Substring(i + 1);
                if (Array.IndexOf(new[] { "next", "prev", "next_guide", "prev_guide", "toggle" }, action) < 0) continue;
                uint mods, vk;
                if (ParseKey(key, out mods, out vk) && RegisterHotKey(Handle, next, mods | MOD_NOREPEAT, vk))
                    hotkeys[next++] = action;
                else
                    failedHotkeys.Add(key.Replace("\"", "").Replace("\\", ""));
            }
        }
        if (web.CoreWebView2 != null)
            web.CoreWebView2.PostWebMessageAsJson("{\"hotkeysFailed\":[" +
                string.Join(",", failedHotkeys.ConvertAll(k => "\"" + k + "\"").ToArray()) + "]}");
    }

    // Те же названия клавиш, что понимал engineer.pyw: F1–F24, Numpad0–9, PageUp, Home, буквы и цифры, ctrl+/alt+/shift+/win+
    static bool ParseKey(string spec, out uint mods, out uint vk)
    {
        mods = 0; vk = 0;
        foreach (string raw in spec.ToLowerInvariant().Replace(" ", "").Split('+'))
        {
            string p = raw;
            int n;
            if (p == "alt") mods |= 0x1;
            else if (p == "ctrl") mods |= 0x2;
            else if (p == "shift") mods |= 0x4;
            else if (p == "win") mods |= 0x8;
            else if (p.Length > 1 && p[0] == 'f' && int.TryParse(p.Substring(1), out n) && n >= 1 && n <= 24) vk = (uint)(0x6F + n);
            else if (p.StartsWith("numpad") && int.TryParse(p.Substring(6), out n) && n >= 0 && n <= 9) vk = (uint)(0x60 + n);
            else if (p == "pageup") vk = 0x21;
            else if (p == "pagedown") vk = 0x22;
            else if (p == "end") vk = 0x23;
            else if (p == "home") vk = 0x24;
            else if (p == "left") vk = 0x25;
            else if (p == "up") vk = 0x26;
            else if (p == "right") vk = 0x27;
            else if (p == "down") vk = 0x28;
            else if (p == "insert") vk = 0x2D;
            else if (p == "delete") vk = 0x2E;
            else if (p == "pause") vk = 0x13;
            else if (p == "scrolllock") vk = 0x91;
            else if (p.Length == 1 && char.IsLetterOrDigit(p[0]) && p[0] < 128) vk = char.ToUpperInvariant(p[0]);
        }
        return vk != 0;
    }

    protected override void WndProc(ref Message m)
    {
        string action;
        if (m.Msg == WM_HOTKEY && hotkeys.TryGetValue(m.WParam.ToInt32(), out action))
        {
            // Окно показываем без захвата фокуса — игра остаётся активной
            if (action == "toggle" || hiddenByHotkey)
            {
                hiddenByHotkey = !hiddenByHotkey;
                ShowWindow(Handle, hiddenByHotkey ? 0 : 4); // SW_HIDE / SW_SHOWNOACTIVATE
            }
            if (action != "toggle" && web.CoreWebView2 != null)
                web.CoreWebView2.PostWebMessageAsJson("{\"hotkey\":\"" + action + "\"}");
            return;
        }
        base.WndProc(ref m);
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        foreach (int id in hotkeys.Keys) UnregisterHotKey(Handle, id);
        RememberBounds();
        state["mode"] = Key;
        state.Save();
        base.OnFormClosing(e);
    }

    // ---------- Тема заголовка окна ----------

    // Тёмный системный заголовок окна (Windows 10 20H1+ и Windows 11)
    void ApplyCaption()
    {
        int on = dark ? 1 : 0;
        try
        {
            if (DwmSetWindowAttribute(Handle, 20, ref on, 4) != 0)
                DwmSetWindowAttribute(Handle, 19, ref on, 4); // старые сборки Windows 10
        }
        catch { }
    }

    void SetTheme(bool isDark)
    {
        if (isDark == dark) return;
        dark = isDark;
        ApplyCaption();
        // Windows перерисовывает рамку только при смене размера — слегка «пошевелим» окно
        if (WindowState == FormWindowState.Normal) { Width += 1; Width -= 1; }
        state["theme"] = dark ? "dark" : "light";
        state.Save();
    }

    // ---------- WebView2 ----------

    async Task InitAsync()
    {
        string baseDir = Program.BaseDir;
        string binDir = Path.Combine(baseDir, "bin");
        try
        {
            Program.Extract("WebView2Loader.dll", Path.Combine(binDir, "WebView2Loader.dll"));
            CoreWebView2Environment.SetLoaderDllFolderPath(binDir);
            CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(baseDir, "data"));
            await web.EnsureCoreWebView2Async(env);

            CoreWebView2 core = web.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreBrowserAcceleratorKeysEnabled = false;

            // Оболочка и приложения — из ресурсов exe, без кэша (после обновления сразу видна новая версия)
            core.AddWebResourceRequestedFilter("https://" + Host + "/*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += (s, a) =>
            {
                string path = Uri.UnescapeDataString(new Uri(a.Request.Uri).AbsolutePath).TrimStart('/');
                if (path.Length == 0 || path.EndsWith("/")) path += "index.html";
                byte[] data = Program.Resource("web/" + path);
                if (data == null)
                {
                    a.Response = env.CreateWebResourceResponse(null, 404, "Not Found", "");
                    return;
                }
                a.Response = env.CreateWebResourceResponse(new MemoryStream(data), 200, "OK",
                    "Content-Type: " + MimeType(path) + "\r\nCache-Control: no-store");
            };

            // Внешние ссылки — в обычный браузер; ни окно, ни приложения внутри не уходят со своих страниц
            core.NewWindowRequested += (s, a) => { a.Handled = true; OpenExternal(a.Uri); };
            core.NavigationStarting += (s, a) =>
            {
                if (!IsOwn(a.Uri)) { a.Cancel = true; OpenExternal(a.Uri); }
            };
            core.FrameNavigationStarting += (s, a) =>
            {
                if (!IsOwn(a.Uri)) { a.Cancel = true; OpenExternal(a.Uri); }
            };

            core.WebMessageReceived += (s, a) =>
            {
                string msg;
                try { msg = a.TryGetWebMessageAsString(); } catch { return; } // сообщения от самих приложений — не нам
                if (msg == null) return;
                if (msg == "hello") PostState();
                else if (msg == "mode:compact") SetMode(true);
                else if (msg == "mode:expanded") SetMode(false);
                else if (msg == "pin:1") SetPinned(true);
                else if (msg == "pin:0") SetPinned(false);
                else if (msg == "theme:dark") SetTheme(true);
                else if (msg == "theme:light") SetTheme(false);
                else if (msg.StartsWith("title:")) Text = msg.Substring(6);
                else if (msg.StartsWith("hotkeys:")) SetHotkeys(msg.Substring(8));
            };

            core.Navigate("https://" + Host + "/index.html");
        }
        catch (WebView2RuntimeNotFoundException)
        {
            const string url = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
            if (MessageBox.Show(
                    "Для работы Пульта нужен компонент Microsoft Edge WebView2 (в Windows 11 он уже есть).\n\nОткрыть страницу загрузки?",
                    Title, MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes)
                OpenExternal(url);
            Close();
        }
        catch (Exception ex)
        {
            MessageBox.Show("Не удалось запустить Пульт:\n\n" + ex.Message, Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    static bool IsOwn(string uri)
    {
        return uri.StartsWith("https://" + Host + "/") || uri.StartsWith("about:") ||
               uri.StartsWith("data:") || uri.StartsWith("blob:");
    }

    static string MimeType(string path)
    {
        string ext = Path.GetExtension(path).ToLowerInvariant();
        switch (ext)
        {
            case ".html": return "text/html; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".js": return "text/javascript; charset=utf-8";
            case ".json": return "application/json; charset=utf-8";
            case ".svg": return "image/svg+xml";
            case ".png": return "image/png";
            case ".ico": return "image/x-icon";
            case ".woff2": return "font/woff2";
            default: return "application/octet-stream";
        }
    }

    static void OpenExternal(string url)
    {
        if (url.StartsWith("http://") || url.StartsWith("https://"))
            try { Process.Start(url); } catch { }
    }
}
