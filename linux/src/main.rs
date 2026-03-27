use gtk4::prelude::*;
use gtk4::{gdk, Application, ApplicationWindow, Box as GtkBox, Orientation, WebView};
use webkit6::{WebContext, WebView as WebKitWebView, WebsiteDataManager};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::rc::Rc;
use std::sync::Arc;
use gtk4::glib::MainContext;

const APP_ID: &str = "com.prompteditor.PromptEditor";
const WINDOW_WIDTH: i32 = 800;
const WINDOW_HEIGHT: i32 = 400;

#[derive(Serialize, Deserialize, Debug)]
struct EditorMessage {
    action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
}

fn main() {
    // Initialize GTK
    gtk4::init().expect("Failed to initialize GTK");

    // Create application
    let app = Application::builder()
        .application_id(APP_ID)
        .build();

    app.connect_activate(build_ui);

    // Setup global shortcut (Ctrl+Alt+Space)
    setup_global_shortcut(&app);

    // Run application
    app.run();
}

fn build_ui(app: &Application) {
    // Create window
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Prompt Editor")
        .default_width(WINDOW_WIDTH)
        .default_height(WINDOW_HEIGHT)
        .build();

    // Set window to appear centered and on top
    window.set_position(gtk4::WindowPosition::Center);
    window.set_keep_above(true);

    // Create WebView
    let context = WebContext::default().unwrap();
    let data_manager = WebsiteDataManager::default().unwrap();
    
    let webview = WebKitWebView::builder()
        .web_context(&context)
        .build();

    // Load the editor HTML
    // Try to load from installed location first, then fallback to local path
    let html_path = get_html_path();
    let uri = format!("file://{}", html_path);
    webview.load_uri(&uri);

    // Setup message handler for communication with the editor
    setup_message_handler(&webview, &window);

    // Add WebView to window
    window.set_child(Some(&webview));

    // Handle visibility
    window.connect_close_request(move |window| {
        window.hide();
        glib::Propagation::Proceed
    });

    window.present();

    // Store window reference for global shortcut
    store_window_reference(&window);
}

fn get_html_path() -> String {
    // Check if running from installed location
    let data_dirs = std::env::var("XDG_DATA_DIRS").unwrap_or_else(|_| "/usr/local/share:/usr/share".to_string());
    
    for dir in data_dirs.split(':') {
        let path = format!("{}/prompt-editor/editor/dist/index.html", dir);
        if std::path::Path::new(&path).exists() {
            return path;
        }
    }

    // Fallback to relative path for development
    let exe_path = std::env::current_exe().expect("Failed to get executable path");
    let dev_path = exe_path.parent()
        .and_then(|p| p.parent())
        .map(|p| p.join("../editor/dist/index.html"))
        .expect("Failed to construct path");
    
    dev_path.to_string_lossy().to_string()
}

fn setup_message_handler(webview: &WebKitWebView, window: &ApplicationWindow) {
    use webkit6::UserContentManager;
    use gtk4::glib;

    let content_manager = webview.user_content_manager().unwrap();
    
    // Register message handler
    let window_weak = window.downgrade();
    content_manager.register_script_message_handler("promptEditor", None, move |message| {
        if let Some(js_result) = message.js_value() {
            if let Some(json_str) = js_result.to_string() {
                if let Ok(msg) = serde_json::from_str::<EditorMessage>(&json_str) {
                    handle_editor_message(msg, &window_weak);
                }
            }
        }
    });

    // Inject JavaScript bridge
    let script = r#"
        window.promptEditor = {
            getContent: function() { return window.editorContent || ''; },
            setContent: function(text) { window.editorContent = text; },
            focus: function() { document.querySelector('.cm-editor').focus(); }
        };
    "#;
    
    webview.evaluate_javascript(script, None, None::<&gio::Cancellable>, |_result| {
        // Script injected
    });
}

fn handle_editor_message(message: EditorMessage, window: &glib::WeakRef<ApplicationWindow>) {
    match message.action.as_str() {
        "send" => {
            if let Some(content) = message.content {
                // Hide window
                if let Some(win) = window.upgrade() {
                    win.hide();
                }
                
                // Send to terminal
                send_to_terminal(&content);
            }
        }
        "copy" => {
            if let Some(content) = message.content {
                copy_to_clipboard(&content);
            }
        }
        "hide" => {
            if let Some(win) = window.upgrade() {
                win.hide();
            }
        }
        _ => {}
    }
}

fn send_to_terminal(content: &str) {
    use std::thread;
    use std::time::Duration;
    use std::process::Command;

    // Copy content to clipboard
    copy_to_clipboard(content);
    
    thread::sleep(Duration::from_millis(100));

    // Use xdotool or wtype to simulate paste and enter
    // Try wtype (Wayland) first
    let wtype_result = Command::new("wtype")
        .args(&["-M", "ctrl", "v", "-m", "ctrl"])
        .spawn();

    if wtype_result.is_err() {
        // Fallback to xdotool (X11)
        let _ = Command::new("xdotool")
            .args(&["key", "ctrl+v"])
            .spawn();
    }

    // Wait a bit then press Enter
    thread::sleep(Duration::from_millis(200));
    
    let enter_result = Command::new("wtype")
        .arg("Return")
        .spawn();
    
    if enter_result.is_err() {
        let _ = Command::new("xdotool")
            .arg("key")
            .arg("Return")
            .spawn();
    }
}

fn copy_to_clipboard(content: &str) {
    use cli_clipboard::{ClipboardContext, ClipboardProvider};
    
    if let Ok(mut ctx) = ClipboardContext::new() {
        let _ = ctx.set_contents(content.to_string());
    }
}

#[cfg(feature = "x11")]
fn setup_global_shortcut(_app: &Application) {
    use x11rb::connection::Connection;
    use x11rb::protocol::xproto::*;
    use x11rb::protocol::Event;
    
    // This is a simplified version. In production, you'd use a proper
    // global hotkey library like global-hotkey crate
    std::thread::spawn(|| {
        // Try to connect to X11
        if let Ok((conn, screen_num)) = x11rb::connect(None) {
            let screen = &conn.setup().roots[screen_num];
            
            // Grab Ctrl+Alt+Space
            // Note: This is simplified - real implementation needs more error handling
            let _ = conn.grab_key(
                true,  // owner_events
                screen.root,
                ModMask::CONTROL | ModMask::MOD1,  // Ctrl+Alt
                65,  // Space keycode (varies by keyboard layout)
                GrabMode::ASYNC,
                GrabMode::ASYNC,
            );
            
            loop {
                if let Ok(event) = conn.wait_for_event() {
                    match event {
                        Event::KeyPress(_) => {
                            // Toggle window visibility
                            toggle_window();
                        }
                        _ => {}
                    }
                }
            }
        }
    });
}

#[cfg(not(feature = "x11"))]
fn setup_global_shortcut(_app: &Application) {
    // Wayland doesn't support global shortcuts directly
    // Users would need to configure shortcuts in their compositor
    eprintln!("Global shortcuts not supported on Wayland. Please configure a shortcut to run: prompt-editor --toggle");
}

fn store_window_reference(window: &ApplicationWindow) {
    // Store window reference for global shortcut access
    // In a real implementation, you'd use a proper shared state
    WINDOW.with(|w| {
        *w.borrow_mut() = Some(window.clone());
    });
}

fn toggle_window() {
    WINDOW.with(|w| {
        if let Some(ref window) = *w.borrow() {
            if window.is_visible() {
                window.hide();
            } else {
                window.show();
                window.present();
            }
        }
    });
}

thread_local! {
    static WINDOW: RefCell<Option<ApplicationWindow>> = RefCell::new(None);
}
