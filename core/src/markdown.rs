use pulldown_cmark::{html, Options, Parser};

pub fn to_html(markdown: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);

    let parser = Parser::new_ext(markdown, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    html_output
}

/// Strip markdown formatting, returning plain text.
pub fn to_plain_text(markdown: &str) -> String {
    let parser = Parser::new(markdown);
    let mut text = String::new();
    for event in parser {
        match event {
            pulldown_cmark::Event::Text(t) => text.push_str(&t),
            pulldown_cmark::Event::Code(c) => text.push_str(&c),
            pulldown_cmark::Event::SoftBreak | pulldown_cmark::Event::HardBreak => {
                text.push('\n')
            }
            _ => {}
        }
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    // MARK: to_html basic

    #[test]
    fn test_to_html_heading() {
        let html = to_html("# Hello");
        assert!(html.contains("<h1>Hello</h1>"));
    }

    #[test]
    fn test_to_html_bold() {
        let html = to_html("This is **bold** text.");
        assert!(html.contains("<strong>bold</strong>"));
    }

    #[test]
    fn test_to_html_italic() {
        let html = to_html("This is *italic* text.");
        assert!(html.contains("<em>italic</em>"));
    }

    #[test]
    fn test_to_html_code_inline() {
        let html = to_html("Use `cargo test` to run.");
        assert!(html.contains("<code>cargo test</code>"));
    }

    #[test]
    fn test_to_html_code_block() {
        let md = "```rust\nfn main() {}\n```";
        let html = to_html(md);
        assert!(html.contains("<pre>"));
        assert!(html.contains("<code"));
        assert!(html.contains("fn main()"));
    }

    #[test]
    fn test_to_html_unordered_list() {
        let md = "- item 1\n- item 2\n- item 3";
        let html = to_html(md);
        assert!(html.contains("<ul>"));
        assert!(html.contains("<li>item 1</li>"));
        assert!(html.contains("<li>item 2</li>"));
        assert!(html.contains("<li>item 3</li>"));
    }

    #[test]
    fn test_to_html_ordered_list() {
        let md = "1. first\n2. second";
        let html = to_html(md);
        assert!(html.contains("<ol>"));
        assert!(html.contains("<li>first</li>"));
    }

    #[test]
    fn test_to_html_link() {
        let md = "[click here](https://example.com)";
        let html = to_html(md);
        assert!(html.contains("href=\"https://example.com\""));
        assert!(html.contains("click here"));
    }

    #[test]
    fn test_to_html_blockquote() {
        let md = "> This is a quote";
        let html = to_html(md);
        assert!(html.contains("<blockquote>"));
    }

    #[test]
    fn test_to_html_headings_h1_to_h3() {
        assert!(to_html("# H1").contains("<h1>"));
        assert!(to_html("## H2").contains("<h2>"));
        assert!(to_html("### H3").contains("<h3>"));
    }

    // MARK: Extended features

    #[test]
    fn test_to_html_strikethrough() {
        let html = to_html("~~deleted~~");
        assert!(html.contains("<del>deleted</del>"));
    }

    #[test]
    fn test_to_html_table() {
        let md = "| A | B |\n|---|---|\n| 1 | 2 |";
        let html = to_html(md);
        assert!(html.contains("<table>"));
        assert!(html.contains("<th>A</th>"));
        assert!(html.contains("<td>1</td>"));
    }

    #[test]
    fn test_to_html_tasklist() {
        let md = "- [x] done\n- [ ] todo";
        let html = to_html(md);
        assert!(html.contains("checked"));
        assert!(html.contains("type=\"checkbox\""));
    }

    // MARK: Edge cases

    #[test]
    fn test_to_html_empty() {
        assert_eq!(to_html(""), "");
    }

    #[test]
    fn test_to_html_plain_text() {
        let html = to_html("just text");
        assert!(html.contains("just text"));
        assert!(html.contains("<p>"));
    }

    #[test]
    fn test_to_html_raw_html_passthrough() {
        // pulldown-cmark passes raw HTML through by default
        let html = to_html("<div>content</div>");
        assert!(html.contains("<div>content</div>"));
    }

    #[test]
    fn test_to_html_unicode() {
        let html = to_html("# 你好世界 🌍");
        assert!(html.contains("你好世界 🌍"));
    }

    #[test]
    fn test_to_html_nested_formatting() {
        let html = to_html("***bold italic***");
        assert!(html.contains("<strong>") || html.contains("<em>"));
    }

    #[test]
    fn test_to_html_horizontal_rule() {
        let html = to_html("---");
        assert!(html.contains("<hr"));
    }

    #[test]
    fn test_to_html_multiple_paragraphs() {
        let html = to_html("Para 1\n\nPara 2");
        let count = html.matches("<p>").count();
        assert_eq!(count, 2);
    }

    // MARK: to_plain_text

    #[test]
    fn test_to_plain_text_basic() {
        let text = to_plain_text("**bold** and *italic*");
        assert_eq!(text, "bold and italic");
    }

    #[test]
    fn test_to_plain_text_heading() {
        let text = to_plain_text("# Hello World");
        assert_eq!(text, "Hello World");
    }

    #[test]
    fn test_to_plain_text_list() {
        let text = to_plain_text("- item 1\n- item 2");
        assert!(text.contains("item 1"));
        assert!(text.contains("item 2"));
    }

    #[test]
    fn test_to_plain_text_link() {
        let text = to_plain_text("[click](https://example.com)");
        assert!(text.contains("click"));
    }

    #[test]
    fn test_to_plain_text_empty() {
        assert_eq!(to_plain_text(""), "");
    }

    #[test]
    fn test_to_plain_text_code() {
        let text = to_plain_text("Use `cargo test`");
        assert!(text.contains("Use "));
        assert!(text.contains("cargo test"));
    }
}
