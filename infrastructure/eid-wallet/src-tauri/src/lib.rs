mod errors;
mod funcs;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
// #[tauri::command]
// fn greet(name: &str) -> String {
//     format!("Hello, {}! You've been greeted from Rust!", name)
// }

#[tauri::command]
async fn hash(pin: String) -> Result<String, String> {
    Ok(funcs::hash(pin).map_err(|err| err.to_string())?)
}

#[tauri::command]
async fn verify(pin: String, hash: String) -> Result<bool, String> {
    Ok(funcs::verify(pin, hash).map_err(|err| err.to_string())?)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(move |_app| {
            #[cfg(mobile)]
            {
                _app.handle().plugin(tauri_plugin_biometric::init())?;
            }
            Ok(())
        })
        // Register the commands with Tauri.
        .invoke_handler(tauri::generate_handler![hash, verify])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
