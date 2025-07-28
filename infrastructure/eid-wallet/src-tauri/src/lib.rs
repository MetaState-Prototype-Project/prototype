mod errors;
mod funcs;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
// #[tauri::command]
// fn greet(name: &str) -> String {
//     format!("Hello, {}! You've been greeted from Rust!", name)
// }

/// Hashes a PIN using Argon2 with a random salt
///
/// # Arguments
/// * `pin` - A string containing the user's PIN
///
/// # Returns
/// * `Result<String, String>` - The hashed PIN string or an error message
#[tauri::command]
async fn hash(pin: String) -> Result<String, String> {
    funcs::hash(pin).map_err(|err| format!("Failed to hash PIN: {}", err))
}

/// Verifies a PIN against a stored hash using Argon2
///
/// # Arguments
/// * `pin` - A string containing the user's PIN to verify
/// * `hash` - The stored hash to compare against
///
/// # Returns
/// * `Result<bool, String>` - Whether the PIN matches the hash, or an error message
#[tauri::command]
async fn verify(pin: String, hash: String) -> Result<bool, String> {
    funcs::verify(pin, hash).map_err(|err| format!("Failed to verify PIN: {}", err))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(move |_app| {
            #[cfg(mobile)]
            {
                _app.handle().plugin(tauri_plugin_biometric::init())?;
                _app.handle().plugin(tauri_plugin_barcode_scanner::init())?;
            }
            Ok(())
        })
        // Register the commands with Tauri.
        .invoke_handler(tauri::generate_handler![hash, verify])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
