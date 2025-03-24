# THIS FILE IS AUTO-GENERATED. DO NOT MODIFY!!

# Copyright 2020-2023 Tauri Programme within The Commons Conservancy
# SPDX-License-Identifier: Apache-2.0
# SPDX-License-Identifier: MIT

-keep class com.eid_wallet.app.* {
  native <methods>;
}

-keep class com.eid_wallet.app.WryActivity {
  public <init>(...);

  void setWebView(com.eid_wallet.app.RustWebView);
  java.lang.Class getAppClass(...);
  java.lang.String getVersion();
}

-keep class com.eid_wallet.app.Ipc {
  public <init>(...);

  @android.webkit.JavascriptInterface public <methods>;
}

-keep class com.eid_wallet.app.RustWebView {
  public <init>(...);

  void loadUrlMainThread(...);
  void loadHTMLMainThread(...);
  void evalScript(...);
}

-keep class com.eid_wallet.app.RustWebChromeClient,com.eid_wallet.app.RustWebViewClient {
  public <init>(...);
}
