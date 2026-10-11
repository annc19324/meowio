package com.epu.meowio;

import android.annotation.SuppressLint;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    // Thay đổi GAME_URL này thành domain Render hoặc Vercel khi bạn deploy online
    // Ví dụ: "https://meow-io.onrender.com" hoặc "https://meow-io.vercel.app"
    // Với Android Emulator test localhost trên PC, dùng: "http://10.0.2.2:3000"
    // Nếu chạy trên điện thoại thật cùng mạng Wifi, dùng IP máy tính ví dụ: "http://192.168.1.15:3000"
    public static final String GAME_URL = "http://10.0.2.2:3000";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Chế độ Fullscreen toàn màn hình
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        hideSystemUI();

        webView = new WebView(this);
        setContentView(webView);

        // Kích hoạt tăng tốc phần cứng GPU (Hardware Acceleration) cho 60-120 FPS
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Thêm định danh "MeowApp" vào User-Agent để web tự nhận diện là App
        String originalUA = settings.getUserAgentString();
        settings.setUserAgentString(originalUA + " MeowApp");

        // Javascript Interface đánh dấu app
        webView.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public boolean isApp() {
                return true;
            }
        }, "Android");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Bơm cờ đánh dấu app vào cửa sổ JavaScript
                webView.evaluateJavascript("window.isAndroidApp = true; if(document.getElementById('downloadAppWrapper')) document.getElementById('downloadAppWrapper').style.display='none';", null);
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        // Load Game URL
        webView.loadUrl(GAME_URL);
    }

    private void hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
