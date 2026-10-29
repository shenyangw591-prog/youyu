package com.youyu.ledger.beta;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.Toast;
import android.widget.TextView;
import android.window.OnBackInvokedDispatcher;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.HashMap;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String KEY_ALIAS = "youyu-ledger-local-v1";
    private static final int FILE_OPEN = 1001, FILE_EXPORT = 1002, MAX_BYTES = 2 * 1024 * 1024;
    private WebView webView;
    private BundledAssets bundledAssets;
    private ValueCallback<Uri[]> chooserCallback;
    private String pendingExport;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xfff6fbf8);
        webView = new WebView(this);
        root.addView(webView, new LinearLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int left, top, right, bottom;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                left = bars.left; top = bars.top; right = bars.right; bottom = bars.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft(); top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight(); bottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(left, top, right, bottom);
            return insets.consumeSystemWindowInsets();
        });
        root.requestApplyInsets();
        final String startupHtml;
        try {
            bundledAssets = new BundledAssets(getApplicationInfo().sourceDir);
            startupHtml = bundledAssets.readHtml();
        } catch (Exception e) {
            Log.e("YouyuStartup", "Cannot read bundled startup page", e);
            TextView error = new TextView(this);
            error.setText("有余启动页面读取失败（0.1.2）\n请保留应用，并将此提示反馈给开发者。");
            error.setTextSize(18);
            error.setPadding(32, 48, 32, 32);
            root.removeView(webView);
            root.addView(error);
            return;
        }
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setSupportMultipleWindows(false);
        WebView.setWebContentsDebuggingEnabled(false);
        webView.addJavascriptInterface(new LedgerBridge(), "AndroidLedger");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isAppUrl(request.getUrl());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!isAppUrl(uri)) return errorResponse("Blocked");
                String filename = uri.getPath();
                if (filename == null || filename.equals("/")) filename = "/index.html";
                try {
                    InputStream stream = bundledAssets.open(filename);
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'");
                    headers.put("X-Content-Type-Options", "nosniff");
                    WebResourceResponse response = new WebResourceResponse(mime(filename), "UTF-8", stream);
                    response.setResponseHeaders(headers);
                    return response;
                } catch (Exception e) {
                    Log.e("YouyuStartup", "Cannot read bundled resource: " + filename, e);
                    return errorResponse("页面资源读取失败：" + filename);
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (chooserCallback != null) chooserCallback.onReceiveValue(null);
                chooserCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(intent, FILE_OPEN); }
                catch (Exception e) { chooserCallback.onReceiveValue(null); chooserCallback = null; notifyUser("无法打开文件选择器"); }
                return true;
            }
        });
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        String baseUrl = "https://" + HOST + "/";
        webView.loadDataWithBaseURL(baseUrl, startupHtml, "text/html", null, baseUrl);
    }

    private boolean isAppUrl(Uri uri) { return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443); }
    private WebResourceResponse errorResponse(String message) { return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, new ByteArrayInputStream(message.getBytes(StandardCharsets.UTF_8))); }
    private String mime(String filename) {
        if (filename.endsWith(".html")) return "text/html";
        if (filename.endsWith(".js") || filename.endsWith(".mjs")) return "text/javascript";
        if (filename.endsWith(".css")) return "text/css";
        if (filename.endsWith(".png")) return "image/png";
        if (filename.endsWith(".webp")) return "image/webp";
        if (filename.endsWith(".svg")) return "image/svg+xml";
        if (filename.endsWith(".woff2")) return "font/woff2";
        if (filename.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }
    private void notifyUser(String message) { runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show()); }

    private SecretKey ledgerKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(KEY_ALIAS)) return (SecretKey) store.getKey(KEY_ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
        return generator.generateKey();
    }
    private AtomicFile ledgerFile() { return new AtomicFile(new File(getFilesDir(), "ledger-v1.enc")); }

    private class LedgerBridge {
        @JavascriptInterface public synchronized String readLedger() {
            JSONObject result = new JSONObject();
            try {
                AtomicFile file = ledgerFile();
                if (!file.getBaseFile().exists() && !new File(getFilesDir(), "ledger-v1.enc.bak").exists()) { result.put("status", "empty"); return result.toString(); }
                JSONObject encrypted = new JSONObject(new String(file.readFully(), StandardCharsets.UTF_8));
                if (encrypted.getInt("version") != 1) throw new IllegalStateException("Unknown storage version");
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, ledgerKey(), new GCMParameterSpec(128, Base64.decode(encrypted.getString("iv"), Base64.NO_WRAP)));
                byte[] content = cipher.doFinal(Base64.decode(encrypted.getString("data"), Base64.NO_WRAP));
                result.put("status", "ready"); result.put("content", new String(content, StandardCharsets.UTF_8));
            } catch (Exception e) {
                try { result.put("status", "error"); result.put("error", "本机账本暂时无法读取，请保留应用并恢复备份"); } catch (Exception ignored) {}
            }
            return result.toString();
        }
        @JavascriptInterface public synchronized String saveLedger(String content) {
            FileOutputStream output = null;
            AtomicFile file = ledgerFile();
            try {
                if (content == null || content.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) return "账本超出本机存储容量";
                JSONObject parsed = new JSONObject(content);
                if (!"youyu-ledger-backup".equals(parsed.getString("format")) || parsed.getInt("version") != 1 || !parsed.has("ledger")) return "账本格式无效，未保存";
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, ledgerKey());
                byte[] encrypted = cipher.doFinal(content.getBytes(StandardCharsets.UTF_8));
                JSONObject data = new JSONObject(); data.put("version", 1);
                data.put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)); data.put("data", Base64.encodeToString(encrypted, Base64.NO_WRAP));
                output = file.startWrite(); output.write(data.toString().getBytes(StandardCharsets.UTF_8)); file.finishWrite(output);
                return "";
            } catch (Exception e) { if (output != null) file.failWrite(output); return "本机保存未成功，请检查存储空间后重试"; }
        }
        @JavascriptInterface public void exportFile(String name, String mime, String content) {
            if (content == null || content.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) { notifyUser("导出文件过大"); return; }
            final String safeName = name.endsWith(".csv") ? "有余-账单导入示例.csv" : "有余-账本备份.json";
            runOnUiThread(() -> {
                if (pendingExport != null) { notifyUser("请先完成当前导出"); return; }
                pendingExport = content;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT); intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(name.endsWith(".csv") ? "text/csv" : "application/json"); intent.putExtra(Intent.EXTRA_TITLE, safeName);
                try { startActivityForResult(intent, FILE_EXPORT); } catch (Exception e) { pendingExport = null; notifyUser("无法打开保存位置"); }
            });
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_OPEN && chooserCallback != null) {
            chooserCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data)); chooserCallback = null;
        }
        if (requestCode == FILE_EXPORT) {
            String content = pendingExport; pendingExport = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && content != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    if (output == null) throw new IllegalStateException("Output unavailable");
                    output.write(content.getBytes(StandardCharsets.UTF_8)); notifyUser("文件已导出");
                } catch (Exception e) { notifyUser("导出未成功，请重新选择保存位置"); }
            }
        }
    }
    private void handleBack() {
        if (Build.VERSION.SDK_INT >= 30 && webView.getRootWindowInsets() != null && webView.getRootWindowInsets().isVisible(WindowInsets.Type.ime())) {
            ((InputMethodManager) getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(webView.getWindowToken(), 0); return;
        }
        webView.evaluateJavascript("window.YouyuHandleBack ? window.YouyuHandleBack() : false", value -> { if (!"true".equals(value)) finish(); });
    }
    @Override public void onBackPressed() { handleBack(); }
    @Override protected void onDestroy() {
        if (chooserCallback != null) chooserCallback.onReceiveValue(null);
        if (webView != null) { webView.removeJavascriptInterface("AndroidLedger"); webView.destroy(); }
        if (bundledAssets != null) { try { bundledAssets.close(); } catch (Exception ignored) {} }
        super.onDestroy();
    }
}
