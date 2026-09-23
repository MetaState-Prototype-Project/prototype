mod errors;
mod funcs;

use std::env;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
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

/// Forwards a frontend log line to the Tauri host process stdout/stderr so
/// devs can see console output in the terminal that ran `tauri dev`, without
/// needing the WebView devtools to be attachable.
#[tauri::command]
fn log_to_terminal(level: String, message: String) {
    match level.as_str() {
        "error" => eprintln!("[FE error] {}", message),
        "warn" => eprintln!("[FE warn]  {}", message),
        "info" => println!("[FE info]  {}", message),
        "debug" => println!("[FE debug] {}", message),
        _ => println!("[FE log]   {}", message),
    }
}

// ---------------------------------------------------------------------------
// Crash-safe persistence for the settings store.
//
// Closing the app from the background intermittently signed the user out.
// `tauri-plugin-store` saves with `fs::write`, which opens the file with
// O_TRUNC, so the old contents are discarded before the new bytes land. Its
// auto-save is debounced, and Android kills backgrounded apps with SIGKILL, so
// a save is often still in flight when the kill arrives. Landing in that
// window leaves `global-state.json` at zero bytes with every setting gone, and
// the next launch reads an empty store and starts onboarding from scratch.
//
// An app is only killed after it has been backgrounded, and the webview still
// receives `visibilitychange` at that point. That is a guaranteed safe moment:
// the frontend flushes the store there and then calls `backup_store_file`, so
// no pending write is left for a kill to interrupt and a complete copy exists
// beside the real file.
//
// Nothing here runs during startup or normal use, which keeps the launch path
// free of extra filesystem work.
// ---------------------------------------------------------------------------

/// Absolute path of the store file, resolved once during setup.
///
/// `DeserializeFn` is a plain `fn` pointer and cannot capture state, so the
/// location has to come from a global. The app opens a single store, so one
/// slot is unambiguous.
static STORE_PATH: OnceLock<PathBuf> = OnceLock::new();

const STORE_FILE_NAME: &str = "global-state.json";

fn backup_path_for(primary: &Path) -> PathBuf {
    let mut name = primary.file_name().unwrap_or_default().to_os_string();
    name.push(".bak");
    primary.with_file_name(name)
}

/// Write `bytes` to `path` so that a crash can never expose a partial file.
///
/// The data lands in a temp file which is fsynced before being renamed over
/// the destination. `rename` is atomic on POSIX, so a reader sees either the
/// previous file or the complete new one, never a half-written one.
fn write_file_atomically(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut temp_name = path.file_name().unwrap_or_default().to_os_string();
    temp_name.push(".tmp");
    let temp_path = path.with_file_name(temp_name);

    {
        let mut file = fs::File::create(&temp_path)?;
        file.write_all(bytes)?;
        // A rename is only useful if the bytes it publishes have actually been
        // committed to storage.
        file.sync_all()?;
    }

    fs::rename(&temp_path, path)
}

/// Copy the current store file into its sidecar backup.
///
/// Called when the app is backgrounded, after the frontend has flushed any
/// pending save, so the bytes being copied are the settled ones. Unparseable
/// content is refused: a damaged primary must never overwrite a good backup.
#[tauri::command]
fn backup_store_file() -> Result<(), String> {
    let primary = STORE_PATH
        .get()
        .ok_or_else(|| "store path unavailable".to_string())?;

    let bytes = fs::read(primary).map_err(|error| format!("read failed: {error}"))?;

    if serde_json::from_slice::<serde_json::Value>(&bytes).is_err() {
        return Err(format!(
            "primary is not valid JSON ({} bytes), keeping previous backup",
            bytes.len()
        ));
    }

    write_file_atomically(&backup_path_for(primary), &bytes)
        .map_err(|error| format!("backup write failed: {error}"))
}

/// Decode the store, falling back to the sidecar backup when the primary file
/// cannot be parsed.
///
/// The fallback keys off *unparseable bytes*, never off an empty or missing
/// cache. Clearing the store on logout serialises to `{}`, which is valid JSON
/// and is passed through untouched, so a session the user ended deliberately is
/// never resurrected. Only a half-written file fails to parse, and no code path
/// writes one intentionally. With no readable backup the original parse error
/// is returned so a genuine first launch still runs normal setup rather than
/// receiving invented state.
fn deserialize_with_recovery(
    bytes: &[u8],
) -> std::result::Result<
    std::collections::HashMap<String, serde_json::Value>,
    Box<dyn std::error::Error + Send + Sync>,
> {
    let primary_error = match serde_json::from_slice(bytes) {
        Ok(cache) => return Ok(cache),
        Err(error) => error,
    };

    let Some(primary) = STORE_PATH.get() else {
        return Err(primary_error.into());
    };

    let Ok(backup_bytes) = fs::read(backup_path_for(primary)) else {
        return Err(primary_error.into());
    };

    match serde_json::from_slice(&backup_bytes) {
        Ok(cache) => Ok(cache),
        Err(_) => Err(primary_error.into()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_store::Builder::new()
                .default_deserialize_fn(deserialize_with_recovery)
                .build(),
        )
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notifications::init())
        .setup(move |_app| {
            // Resolve the store location before any store access, so the
            // recovery hook can find the sidecar backup.
            {
                use tauri::Manager;
                if let Ok(dir) = _app.path().app_data_dir() {
                    let _ = STORE_PATH.set(dir.join(STORE_FILE_NAME));
                }
            }

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
            get_platform,
            log_to_terminal,
            backup_store_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
