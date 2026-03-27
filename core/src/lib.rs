pub mod clipboard;
pub mod markdown;
pub mod storage;
pub mod file_scanner;
pub mod template_storage;

use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::sync::Mutex;
use lazy_static::lazy_static;

lazy_static! {
    static ref FILE_CACHE: Mutex<file_scanner::FileCache> = Mutex::new(file_scanner::FileCache::new());
}

/// Copy text to system clipboard. Returns 0 on success, -1 on error.
#[no_mangle]
pub extern "C" fn pe_clipboard_copy(text: *const c_char) -> i32 {
    let c_str = unsafe {
        if text.is_null() {
            return -1;
        }
        CStr::from_ptr(text)
    };
    match c_str.to_str() {
        Ok(s) => match clipboard::copy_to_clipboard(s) {
            Ok(_) => 0,
            Err(_) => -1,
        },
        Err(_) => -1,
    }
}

/// Get clipboard text. Caller must free the returned string with pe_free_string.
#[no_mangle]
pub extern "C" fn pe_clipboard_get() -> *mut c_char {
    match clipboard::get_from_clipboard() {
        Ok(s) => CString::new(s).unwrap_or_default().into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

/// Save a prompt to storage. Returns the prompt ID (>0) on success, -1 on error.
#[no_mangle]
pub extern "C" fn pe_save_prompt(title: *const c_char, content: *const c_char) -> i64 {
    let title = unsafe {
        if title.is_null() {
            return -1;
        }
        match CStr::from_ptr(title).to_str() {
            Ok(s) => s.to_string(),
            Err(_) => return -1,
        }
    };
    let content = unsafe {
        if content.is_null() {
            return -1;
        }
        match CStr::from_ptr(content).to_str() {
            Ok(s) => s.to_string(),
            Err(_) => return -1,
        }
    };

    let mut store = match storage::PromptStore::open_default() {
        Ok(s) => s,
        Err(_) => return -1,
    };
    match store.save(&title, &content) {
        Ok(id) => id as i64,
        Err(_) => -1,
    }
}

/// Convert markdown to HTML. Caller must free with pe_free_string.
#[no_mangle]
pub extern "C" fn pe_markdown_to_html(md: *const c_char) -> *mut c_char {
    let c_str = unsafe {
        if md.is_null() {
            return std::ptr::null_mut();
        }
        CStr::from_ptr(md)
    };
    match c_str.to_str() {
        Ok(s) => {
            let html = markdown::to_html(s);
            CString::new(html).unwrap_or_default().into_raw()
        }
        Err(_) => std::ptr::null_mut(),
    }
}

/// Free a string returned by this library.
#[no_mangle]
pub extern "C" fn pe_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            drop(CString::from_raw(s));
        }
    }
}

/// Scan a directory and return JSON array of files.
/// Returns NULL on error. Caller must free with pe_free_string.
#[no_mangle]
pub extern "C" fn pe_scan_directory(path: *const c_char) -> *mut c_char {
    let path = unsafe {
        if path.is_null() {
            return std::ptr::null_mut();
        }
        match CStr::from_ptr(path).to_str() {
            Ok(s) => s,
            Err(_) => return std::ptr::null_mut(),
        }
    };
    
    match file_scanner::scan_directory(path, None) {
        Ok(files) => {
            // Update cache
            if let Ok(mut cache) = FILE_CACHE.lock() {
                cache.update(files.clone());
            }
            
            // Return JSON
            match serde_json::to_string(&files) {
                Ok(json) => CString::new(json).unwrap_or_default().into_raw(),
                Err(_) => std::ptr::null_mut(),
            }
        }
        Err(_) => std::ptr::null_mut(),
    }
}

/// Read file content.
/// Returns NULL on error. Caller must free with pe_free_string.
#[no_mangle]
pub extern "C" fn pe_read_file(path: *const c_char) -> *mut c_char {
    let path = unsafe {
        if path.is_null() {
            return std::ptr::null_mut();
        }
        match CStr::from_ptr(path).to_str() {
            Ok(s) => s,
            Err(_) => return std::ptr::null_mut(),
        }
    };
    
    match file_scanner::read_file(path) {
        Ok(content) => CString::new(content).unwrap_or_default().into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}

/// Search files in last scanned directory.
/// Returns JSON array. Caller must free with pe_free_string.
#[no_mangle]
pub extern "C" fn pe_search_files(query: *const c_char) -> *mut c_char {
    let query = unsafe {
        if query.is_null() {
            return std::ptr::null_mut();
        }
        match CStr::from_ptr(query).to_str() {
            Ok(s) => s,
            Err(_) => return std::ptr::null_mut(),
        }
    };
    
    if let Ok(cache) = FILE_CACHE.lock() {
        let results: Vec<&file_scanner::FileInfo> = cache.search(query);
        match serde_json::to_string(&results) {
            Ok(json) => CString::new(json).unwrap_or_default().into_raw(),
            Err(_) => std::ptr::null_mut(),
        }
    } else {
        std::ptr::null_mut()
    }
}

/// Get scanned files count.
#[no_mangle]
pub extern "C" fn pe_get_scanned_files_count() -> i32 {
    if let Ok(cache) = FILE_CACHE.lock() {
        cache.all().len() as i32
    } else {
        -1
    }
}

/// Clear file cache.
#[no_mangle]
pub extern "C" fn pe_clear_file_cache() {
    if let Ok(mut cache) = FILE_CACHE.lock() {
        cache.clear();
    }
}

// MARK: Template Storage FFI

use template_storage::{TemplateStore, DataSourceStore, PromptTemplate, DataSource};

static TEMPLATE_STORE: std::sync::Mutex<Option<TemplateStore>> = std::sync::Mutex::new(None);
static DATASOURCE_STORE: std::sync::Mutex<Option<DataSourceStore>> = std::sync::Mutex::new(None);

fn get_template_store() -> Result<std::sync::MutexGuard<'static, Option<TemplateStore>>, String> {
    let mut store = TEMPLATE_STORE.lock().map_err(|e| e.to_string())?;
    if store.is_none() {
        *store = Some(TemplateStore::open_default()?);
    }
    Ok(store)
}

fn get_datasource_store() -> Result<std::sync::MutexGuard<'static, Option<DataSourceStore>>, String> {
    let mut store = DATASOURCE_STORE.lock().map_err(|e| e.to_string())?;
    if store.is_none() {
        *store = Some(DataSourceStore::open_default()?);
    }
    Ok(store)
}

/// List all templates as JSON. Caller must free with pe_free_string.
#[no_mangle]
pub extern "C" fn pe_list_templates() -> *mut c_char {
    match get_template_store() {
        Ok(store) => {
            if let Some(ref s) = *store {
                match serde_json::to_string(s.list()) {
                    Ok(json) => CString::new(json).unwrap_or_default().into_raw(),
                    Err(_) => std::ptr::null_mut(),
                }
            } else {
                std::ptr::null_mut()
            }
        }
        Err(_) => std::ptr::null_mut(),
    }
}

/// Save a template from JSON. Returns 0 on success, -1 on error.
#[no_mangle]
pub extern "C" fn pe_save_template(json: *const c_char) -> i32 {
    if json.is_null() {
        return -1;
    }

    let json_str = unsafe {
        match CStr::from_ptr(json).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    let template: PromptTemplate = match serde_json::from_str(json_str) {
        Ok(t) => t,
        Err(_) => return -1,
    };

    match get_template_store() {
        Ok(mut store) => {
            if let Some(ref mut s) = *store {
                match s.save(template) {
                    Ok(_) => 0,
                    Err(_) => -1,
                }
            } else {
                -1
            }
        }
        Err(_) => -1,
    }
}

/// Delete a template by ID. Returns 0 on success, -1 on error.
#[no_mangle]
pub extern "C" fn pe_delete_template(id: *const c_char) -> i32 {
    if id.is_null() {
        return -1;
    }

    let id_str = unsafe {
        match CStr::from_ptr(id).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    match get_template_store() {
        Ok(mut store) => {
            if let Some(ref mut s) = *store {
                match s.delete(id_str) {
                    Ok(_) => 0,
                    Err(_) => -1,
                }
            } else {
                -1
            }
        }
        Err(_) => -1,
    }
}

/// List all data sources as JSON. Caller must free with pe_free_string.
#[no_mangle]
pub extern "C" fn pe_list_data_sources() -> *mut c_char {
    match get_datasource_store() {
        Ok(store) => {
            if let Some(ref s) = *store {
                match serde_json::to_string(s.list()) {
                    Ok(json) => CString::new(json).unwrap_or_default().into_raw(),
                    Err(_) => std::ptr::null_mut(),
                }
            } else {
                std::ptr::null_mut()
            }
        }
        Err(_) => std::ptr::null_mut(),
    }
}

/// Save a data source from JSON. Returns 0 on success, -1 on error.
#[no_mangle]
pub extern "C" fn pe_save_data_source(json: *const c_char) -> i32 {
    if json.is_null() {
        return -1;
    }

    let json_str = unsafe {
        match CStr::from_ptr(json).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    let data_source: DataSource = match serde_json::from_str(json_str) {
        Ok(d) => d,
        Err(_) => return -1,
    };

    match get_datasource_store() {
        Ok(mut store) => {
            if let Some(ref mut s) = *store {
                match s.save(data_source) {
                    Ok(_) => 0,
                    Err(_) => -1,
                }
            } else {
                -1
            }
        }
        Err(_) => -1,
    }
}

/// Delete a data source by ID. Returns 0 on success, -1 on error.
#[no_mangle]
pub extern "C" fn pe_delete_data_source(id: *const c_char) -> i32 {
    if id.is_null() {
        return -1;
    }

    let id_str = unsafe {
        match CStr::from_ptr(id).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    match get_datasource_store() {
        Ok(mut store) => {
            if let Some(ref mut s) = *store {
                match s.delete(id_str) {
                    Ok(_) => 0,
                    Err(_) => -1,
                }
            } else {
                -1
            }
        }
        Err(_) => -1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::CString;

    // MARK: pe_clipboard_copy / pe_clipboard_get

    #[test]
    fn test_ffi_clipboard_copy_null() {
        let result = pe_clipboard_copy(std::ptr::null());
        assert_eq!(result, -1);
    }

    #[test]
    fn test_ffi_clipboard_roundtrip() {
        let text = CString::new("FFI clipboard test").unwrap();
        let result = pe_clipboard_copy(text.as_ptr());
        assert_eq!(result, 0);

        let got = pe_clipboard_get();
        assert!(!got.is_null());
        let got_str = unsafe { CStr::from_ptr(got) }.to_str().unwrap();
        assert_eq!(got_str, "FFI clipboard test");
        pe_free_string(got);
    }

    #[test]
    fn test_ffi_clipboard_copy_empty() {
        let text = CString::new("").unwrap();
        let result = pe_clipboard_copy(text.as_ptr());
        assert_eq!(result, 0);
    }

    #[test]
    fn test_ffi_clipboard_unicode() {
        let text = CString::new("你好 🌍").unwrap();
        let result = pe_clipboard_copy(text.as_ptr());
        assert_eq!(result, 0);

        let got = pe_clipboard_get();
        assert!(!got.is_null());
        let got_str = unsafe { CStr::from_ptr(got) }.to_str().unwrap();
        assert_eq!(got_str, "你好 🌍");
        pe_free_string(got);
    }

    // MARK: pe_markdown_to_html

    #[test]
    fn test_ffi_markdown_null() {
        let result = pe_markdown_to_html(std::ptr::null());
        assert!(result.is_null());
    }

    #[test]
    fn test_ffi_markdown_basic() {
        let md = CString::new("# Hello").unwrap();
        let result = pe_markdown_to_html(md.as_ptr());
        assert!(!result.is_null());
        let html = unsafe { CStr::from_ptr(result) }.to_str().unwrap();
        assert!(html.contains("<h1>Hello</h1>"));
        pe_free_string(result);
    }

    #[test]
    fn test_ffi_markdown_empty() {
        let md = CString::new("").unwrap();
        let result = pe_markdown_to_html(md.as_ptr());
        assert!(!result.is_null());
        let html = unsafe { CStr::from_ptr(result) }.to_str().unwrap();
        assert_eq!(html, "");
        pe_free_string(result);
    }

    #[test]
    fn test_ffi_markdown_complex() {
        let md = CString::new("**bold** and `code`\n\n- list item").unwrap();
        let result = pe_markdown_to_html(md.as_ptr());
        assert!(!result.is_null());
        let html = unsafe { CStr::from_ptr(result) }.to_str().unwrap();
        assert!(html.contains("<strong>bold</strong>"));
        assert!(html.contains("<code>code</code>"));
        assert!(html.contains("<li>"));
        pe_free_string(result);
    }

    // MARK: pe_save_prompt

    #[test]
    fn test_ffi_save_prompt_null_title() {
        let content = CString::new("content").unwrap();
        let result = pe_save_prompt(std::ptr::null(), content.as_ptr());
        assert_eq!(result, -1);
    }

    #[test]
    fn test_ffi_save_prompt_null_content() {
        let title = CString::new("title").unwrap();
        let result = pe_save_prompt(title.as_ptr(), std::ptr::null());
        assert_eq!(result, -1);
    }

    #[test]
    fn test_ffi_save_prompt_both_null() {
        let result = pe_save_prompt(std::ptr::null(), std::ptr::null());
        assert_eq!(result, -1);
    }

    #[test]
    fn test_ffi_save_prompt_success() {
        let title = CString::new("FFI Test").unwrap();
        let content = CString::new("FFI content").unwrap();
        let result = pe_save_prompt(title.as_ptr(), content.as_ptr());
        assert!(result > 0);
    }

    // MARK: pe_free_string

    #[test]
    fn test_ffi_free_null() {
        // Should not panic
        pe_free_string(std::ptr::null_mut());
    }

    #[test]
    fn test_ffi_free_valid() {
        let s = CString::new("to free").unwrap().into_raw();
        pe_free_string(s); // Should not panic or leak
    }
}
