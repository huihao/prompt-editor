use arboard::Clipboard;

pub fn copy_to_clipboard(text: &str) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard
        .set_text(text.to_string())
        .map_err(|e| e.to_string())
}

pub fn get_from_clipboard() -> Result<String, String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.get_text().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires an interactive system clipboard; run with cargo test clipboard -- --ignored --test-threads=1"]
    fn test_clipboard_roundtrip() {
        let text = "Hello from prompt-editor!";
        copy_to_clipboard(text).expect("copy failed");
        let got = get_from_clipboard().expect("get failed");
        assert_eq!(got, text);
    }
}
