mod errors;
mod funcs;

use std::env;
use uuid::Uuid;

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

/// Gets a unique device identifier
#[tauri::command]
async fn get_device_id() -> Result<String, String> {
    // Try to get device ID from environment or generate one
    if let Ok(device_id) = env::var("DEVICE_ID") {
        Ok(device_id)
    } else {
        // Generate a UUID as device ID
        Ok(Uuid::new_v4().to_string())
    }
}

/// Gets the current platform
#[tauri::command]
async fn get_platform() -> Result<String, String> {
    #[cfg(target_os = "android")]
    return Ok("android".to_string());

    #[cfg(target_os = "ios")]
    return Ok("ios".to_string());

    #[cfg(target_os = "windows")]
    return Ok("windows".to_string());

    #[cfg(target_os = "macos")]
    return Ok("macos".to_string());

    #[cfg(target_os = "linux")]
    return Ok("linux".to_string());

    #[cfg(not(any(
        target_os = "android",
        target_os = "ios",
        target_os = "windows",
        target_os = "macos",
        target_os = "linux"
    )))]
    return Ok("unknown".to_string());
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .setup(move |_app| {
            #[cfg(mobile)]
            {
                _app.handle().plugin(tauri_plugin_biometric::init())?;
                _app.handle().plugin(tauri_plugin_barcode_scanner::init())?;
                _app.handle().plugin(tauri_plugin_crypto_hw::init())?;
            }
            Ok(())
        })
        // Register the commands with Tauri.
        .invoke_handler(tauri::generate_handler![
            hash,
            verify,
            get_device_id,
            get_platform
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
