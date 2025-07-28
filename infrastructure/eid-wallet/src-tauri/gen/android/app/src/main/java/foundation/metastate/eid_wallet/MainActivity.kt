package foundation.metastate.eid_wallet

class MainActivity : TauriActivity() 
// {
//   override fun onCreate(savedInstanceState: Bundle?) {
//         super.onCreate(savedInstanceState)
//         handleDeepLink(intent)
//     }

//     override fun onNewIntent(intent: Intent?) {
//         super.onNewIntent(intent)
//         handleDeepLink(intent)
//     }

//     private fun handleDeepLink(intent: Intent?) {
//         val uri = intent?.data
//         if (uri != null && uri.scheme == "w3ds") {
//             val deeplink = uri.toString()
//             Log.d("DeepLink", "Received: $deeplink")

//             // Send to JS using Tauri's event system
//             this.runOnUiThread {
//                 TauriPlugin.emit("deep-link", mapOf("url" to deeplink))
//             }
//         }
//     }
// }