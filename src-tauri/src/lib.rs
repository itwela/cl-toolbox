use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use notify::{Watcher, RecursiveMode, RecommendedWatcher, Event};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

fn default_commands_path() -> String {
    if cfg!(target_os = "windows") {
        r"C:\Users\itwel\Documents\Itwela-Obsidian\My Commands.md".to_string()
    } else {
        "/Users/itwelaibomu/Desktop/Itwela Obsidian/My Commands.md".to_string()
    }
}
const STORE_FILE: &str = "config.json";
const STORE_KEY_PATH: &str = "commands_path";
const STORE_KEY_THEME: &str = "theme";

struct WatcherState(Mutex<Option<RecommendedWatcher>>);

#[tauri::command]
fn read_commands_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn get_commands_path(app: AppHandle) -> String {
    let store = app.store(STORE_FILE).unwrap();
    store
        .get(STORE_KEY_PATH)
        .and_then(|v: serde_json::Value| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| default_commands_path())
}

#[tauri::command]
fn set_commands_path(app: AppHandle, path: String) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set(STORE_KEY_PATH, serde_json::Value::String(path));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())
}

#[tauri::command]
fn get_theme(app: AppHandle) -> String {
    let store = app.store(STORE_FILE).unwrap();
    store
        .get(STORE_KEY_THEME)
        .and_then(|v: serde_json::Value| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "dark".to_string())
}

#[tauri::command]
fn set_theme(app: AppHandle, theme: String) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e: tauri_plugin_store::Error| e.to_string())?;
    store.set(STORE_KEY_THEME, serde_json::Value::String(theme));
    store.save().map_err(|e: tauri_plugin_store::Error| e.to_string())
}

#[tauri::command]
fn start_file_watcher(app: AppHandle, path: String) -> Result<(), String> {
    let watcher_state = app.state::<WatcherState>();
    let mut current = watcher_state.0.lock().unwrap();

    *current = None;

    let app_handle = app.clone();
    let watch_path = PathBuf::from(&path);

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            use notify::EventKind::*;
            match event.kind {
                Modify(_) | Create(_) | Remove(_) => {
                    let _ = app_handle.emit("commands-file-changed", ());
                }
                _ => {}
            }
        }
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(&watch_path, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    *current = Some(watcher);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(WatcherState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            read_commands_file,
            get_commands_path,
            set_commands_path,
            get_theme,
            set_theme,
            start_file_watcher
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
