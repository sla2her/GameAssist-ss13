// Пульт для Android: одно окно WebView. Страницы оболочки и всех приложений лежат в assets/web
// и отдаются по адресу https://pult.app/ (как в Пульт.exe), поэтому localStorage общий и постоянный,
// а оболочка может подключать к приложениям стили и мост.
// Мост window.PultAndroid: сохранение файлов (через системный диалог «Сохранить»), буфер обмена,
// кнопки громкости для Инженера. Кнопка «Назад» — window.pultBack() в shell.js.
package app.pult;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.util.Base64;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    static final String HOST = "pult.app";
    static final int REQ_SAVE = 1, REQ_OPEN = 2;
    static final int BACK = 0xFF12151B;

    WebView web;
    ValueCallback<Uri[]> fileCallback;
    byte[] pendingSave;
    volatile boolean engineerOpen;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BACK);
        getWindow().setNavigationBarColor(BACK);

        web = new WebView(this);
        web.setBackgroundColor(BACK);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);           // вёрстка приложений рассчитана на свой размер шрифта
        s.setSupportZoom(false);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        web.addJavascriptInterface(new Bridge(), "PultAndroid");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());

        if (state != null) web.restoreState(state);
        else web.loadUrl("https://" + HOST + "/index.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    // ---------- Страницы из assets ----------

    class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (!HOST.equals(u.getHost())) return null; // GitHub и прочая сеть — как обычно
            String path = u.getPath() == null ? "" : u.getPath();
            if (path.isEmpty() || path.endsWith("/")) path += "index.html";
            if (path.startsWith("/")) path = path.substring(1);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            try {
                InputStream in = getAssets().open("web/" + path);
                return new WebResourceResponse(mime(path), "utf-8", 200, "OK", headers, in);
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, null);
            }
        }

        // Внешние ссылки — в браузер телефона, сам Пульт никуда не уходит
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (HOST.equals(u.getHost()) || "about".equals(u.getScheme()) || "blob".equals(u.getScheme()) || "data".equals(u.getScheme()))
                return false;
            openExternal(u);
            return true;
        }
    }

    static String mime(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    void openExternal(Uri u) {
        String sc = u.getScheme();
        if (!"http".equals(sc) && !"https".equals(sc)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
    }

    // ---------- Новые окна и выбор файлов ----------

    class Chrome extends WebChromeClient {
        // target=_blank / window.open: адрес ловим во временном WebView и открываем в браузере
        @Override
        public boolean onCreateWindow(WebView view, boolean dialog, boolean user, Message result) {
            WebView tmp = new WebView(MainActivity.this);
            tmp.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                    openExternal(req.getUrl());
                    v.destroy();
                    return true;
                }
            });
            ((WebView.WebViewTransport) result.obj).setWebView(tmp);
            result.sendToTarget();
            return true;
        }

        // <input type="file">: импорт кода, шаблонов, схем, архивов
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(Intent.createChooser(i, "Выберите файл"), REQ_OPEN);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
            return true;
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_OPEN) {
            Uri[] uris = null;
            if (res == RESULT_OK && data != null) {
                ClipData clip = data.getClipData();
                if (clip != null) {
                    uris = new Uri[clip.getItemCount()];
                    for (int i = 0; i < uris.length; i++) uris[i] = clip.getItemAt(i).getUri();
                } else if (data.getData() != null) uris = new Uri[] { data.getData() };
            }
            if (fileCallback != null) fileCallback.onReceiveValue(uris);
            fileCallback = null;
        } else if (req == REQ_SAVE) {
            byte[] bytes = pendingSave;
            pendingSave = null;
            if (res != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                out.write(bytes);
                Toast.makeText(this, "Файл сохранён", Toast.LENGTH_SHORT).show();
            } catch (IOException | NullPointerException e) {
                Toast.makeText(this, "Не удалось сохранить файл", Toast.LENGTH_LONG).show();
            }
        } else super.onActivityResult(req, res, data);
    }

    // ---------- Мост для shell.js ----------

    class Bridge {
        @JavascriptInterface
        public void saveFile(final String name, final String mime, String base64) {
            final byte[] bytes;
            try { bytes = Base64.decode(base64, Base64.DEFAULT); } catch (IllegalArgumentException e) { return; }
            runOnUiThread(() -> {
                pendingSave = bytes;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                i.putExtra(Intent.EXTRA_TITLE, name);
                try { startActivityForResult(i, REQ_SAVE); }
                catch (ActivityNotFoundException e) { pendingSave = null; }
            });
        }

        @JavascriptInterface
        public void copy(final String text) {
            runOnUiThread(() -> {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                cm.setPrimaryClip(ClipData.newPlainText("Пульт", text));
            });
        }

        @JavascriptInterface
        public String paste() {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData c = cm.getPrimaryClip();
            if (c == null || c.getItemCount() == 0) return "";
            CharSequence t = c.getItemAt(0).coerceToText(MainActivity.this);
            return t == null ? "" : t.toString();
        }

        @JavascriptInterface
        public void setEngineerOpen(boolean open) { engineerOpen = open; }
    }

    // ---------- Кнопки ----------

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.pultBack ? pultBack() : 'exit'", v -> {
            if ("\"exit\"".equals(v)) moveTaskToBack(true); // приложения в памяти не теряют введённое
        });
    }

    // Громкость − / + листают шаги Инженера, пока он открыт
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        if (engineerOpen && (k == KeyEvent.KEYCODE_VOLUME_DOWN || k == KeyEvent.KEYCODE_VOLUME_UP)) {
            if (e.getAction() == KeyEvent.ACTION_DOWN)
                web.evaluateJavascript("pultEngineer('" + (k == KeyEvent.KEYCODE_VOLUME_DOWN ? "next" : "prev") + "')", null);
            return true;
        }
        return super.dispatchKeyEvent(e);
    }
}
