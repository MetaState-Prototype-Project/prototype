package foundation.metastate.eid_wallet

import android.os.Bundle
import android.view.View
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  // Kill the Android WebView overscroll glow/bounce. CSS
  // `overscroll-behavior: none` doesn't reliably suppress it on all
  // Android WebView versions because the glow is drawn natively by the
  // OverScroller, not the renderer. Setting OVER_SCROLL_NEVER on the
  // WebView itself stops it at the source.
  override fun onWebViewCreate(webView: WebView) {
    webView.overScrollMode = View.OVER_SCROLL_NEVER
  }
}
