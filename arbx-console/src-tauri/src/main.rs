#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri_plugin_log::{LogTarget, LoggerBuilder};

#[tauri::command]
fn kill_app() {
    std::process::exit(0);
}

fn main() {
    tauri::Builder::default()
        .plugin(
            LoggerBuilder::new()
                .targets([LogTarget::LogDir, LogTarget::Stdout, LogTarget::Webview])
                .build(),
        )
        .invoke_handler(tauri::generate_handler![kill_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
