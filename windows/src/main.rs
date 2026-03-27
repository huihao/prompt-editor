// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{AppHandle, CustomMenuItem, GlobalShortcutManager, Manager, State, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem, WindowBuilder, WindowUrl};
use serde::{Deserialize, Serialize};

// Stores the terminal window info for sending keystrokes
struct TerminalState {
    last_window: Mutex<Option<String>>,
}

#[derive(Serialize, Deserialize)]
struct EditorMessage {
    action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    target: Option<String>,
}

fn main() {
    // System tray menu
    let quit = CustomMenuItem::new("quit", "Quit");
    let show = CustomMenuItem::new("show", "Show Editor");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .manage(TerminalState {
            last_window: Mutex::new(None),
        })
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick {
                position: _,
                size: _,
                ..
            } => {
                toggle_window(app);
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => {
                    std::process::exit(0);
                }
                "show" => {
                    show_window(app);
                }
                _ => {}
            },
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            handle_editor_message,
            show_window_cmd,
            hide_window_cmd
        ])
        .setup(|app| {
            // Register global shortcut Alt+Space
            let app_handle = app.handle();
            let shortcut_manager = app_handle.global_shortcut_manager();
            shortcut_manager
                .register("Alt+Space", move || {
                    toggle_window(&app_handle);
                })
                .expect("Failed to register global shortcut");

            // Create the main window
            let _window = WindowBuilder::new(
                app,
                "main",
                WindowUrl::App("index.html".into()),
            )
            .title("Prompt Editor")
            .inner_size(800.0, 400.0)
            .center()
            .skip_taskbar(true)
            .always_on_top(true)
            .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn handle_editor_message(
    message: EditorMessage,
    _state: State<TerminalState>,
    app: AppHandle,
) -> Result<(), String> {
    match message.action.as_str() {
        "send" => {
            if let Some(content) = message.content {
                let target = message.target.as_deref().unwrap_or("default");
                
                if target == "copy" {
                    // Copy only mode - don't hide window, just copy
                    copy_to_clipboard(&content);
                } else {
                    // Hide window
                    hide_window(&app);
                    
                    // Send content to terminal using clipboard
                    send_to_terminal(&content, target);
                }
            }
        }
        "copy" => {
            if let Some(content) = message.content {
                // Copy to clipboard
                copy_to_clipboard(&content);
            }
        }
        "hide" => {
            hide_window(&app);
        }
        _ => {}
    }
    Ok(())
}

#[tauri::command]
fn show_window_cmd(app: AppHandle) {
    show_window(&app);
}

#[tauri::command]
fn hide_window_cmd(app: AppHandle) {
    hide_window(&app);
}

fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_window("main") {
        window.show().unwrap();
        window.set_focus().unwrap();
        window.center().unwrap();
    }
}

fn hide_window(app: &AppHandle) {
    if let Some(window) = app.get_window("main") {
        window.hide().unwrap();
    }
}

fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_window("main") {
        if window.is_visible().unwrap() {
            window.hide().unwrap();
        } else {
            window.show().unwrap();
            window.set_focus().unwrap();
            window.center().unwrap();
        }
    }
}

fn send_to_terminal(content: &str, target: &str) {
    use std::thread;
    use std::time::Duration;

    // For now, all targets use the same method on Windows
    // In the future, we could detect specific CLI apps and use different strategies
    match target {
        "copy" => {
            // Copy only, no typing
            copy_to_clipboard(content);
        }
        _ => {
            // Copy content to clipboard
            copy_to_clipboard(content);

            // Wait a bit for clipboard to update
            thread::sleep(Duration::from_millis(100));

            // Use PowerShell to send Ctrl+V to the active terminal window
            let script = format!(
                r#"
                Add-Type @"
                using System;
                using System.Runtime.InteropServices;
                public class WinAPI {{
                    [DllImport("user32.dll")]
                    public static extern IntPtr GetForegroundWindow();
                    
                    [DllImport("user32.dll")]
                    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
                }}
                "@
                
                # Simulate Ctrl+V
                [WinAPI]::keybd_event(0x11, 0, 0, 0)  # Ctrl down
                [WinAPI]::keybd_event(0x56, 0, 0, 0)  # V down
                [WinAPI]::keybd_event(0x56, 0, 2, 0)  # V up
                [WinAPI]::keybd_event(0x11, 0, 2, 0)  # Ctrl up
                "#
            );

            let _ = std::process::Command::new("powershell")
                .args(&["-Command", &script])
                .spawn();

            // Also send Enter key
            thread::sleep(Duration::from_millis(200));
            let enter_script = r#"
                Add-Type @"
                using System;
                using System.Runtime.InteropServices;
                public class WinAPI2 {
                    [DllImport("user32.dll")]
                    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
                }
                "@
                [WinAPI2]::keybd_event(0x0D, 0, 0, 0)   # Enter down
                [WinAPI2]::keybd_event(0x0D, 0, 2, 0)   # Enter up
            "#;

            let _ = std::process::Command::new("powershell")
                .args(&["-Command", enter_script])
                .spawn();
        }
    }
}

fn copy_to_clipboard(content: &str) {
    use clipboard_win::{Clipboard, formats, Setter};
    
    if let Ok(_clip) = Clipboard::new() {
        let _ = clipboard_win::formats::Unicode.write_clipboard(content);
    }
}
