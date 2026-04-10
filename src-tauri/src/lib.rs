pub mod parser;
mod watcher;

#[tauri::command]
async fn list_active_sessions(_app: tauri::AppHandle) -> Result<Vec<parser::SessionEvent>, String> {
    let mut w = watcher::SessionWatcher::new().map_err(|e| e.to_string())?;
    let events: Vec<_> = w
        .discover_active_sessions()
        .into_iter()
        .filter(|e| matches!(e, parser::SessionEvent::SessionDiscovered { .. }))
        .collect();
    Ok(events)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![list_active_sessions])
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                watcher::start_watching(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
