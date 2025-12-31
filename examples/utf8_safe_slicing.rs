// Safe UTF-8 String Slicing Examples for Claude Code
// This file demonstrates proper UTF-8 string handling in Rust

/// Safely slice a string at a byte boundary, adjusting to the nearest valid char boundary
///
/// # Arguments
/// * `s` - The string to slice
/// * `max_bytes` - Maximum byte length (will adjust down to valid char boundary)
///
/// # Returns
/// A string slice that doesn't exceed max_bytes and respects char boundaries
pub fn safe_slice(s: &str, max_bytes: usize) -> &str {
    if max_bytes >= s.len() {
        return s;
    }

    // Find valid character boundary at or before max_bytes
    let mut boundary = max_bytes;
    while boundary > 0 && !s.is_char_boundary(boundary) {
        boundary -= 1;
    }

    &s[0..boundary]
}

/// Safely slice a string at a byte boundary (stable API version)
///
/// This manually finds the valid char boundary
pub fn safe_slice_modern(s: &str, max_bytes: usize) -> &str {
    if max_bytes >= s.len() {
        return s;
    }

    // Manual floor_char_boundary for stable Rust
    let mut boundary = max_bytes;
    while boundary > 0 && !s.is_char_boundary(boundary) {
        boundary -= 1;
    }
    &s[0..boundary]
}

/// Truncate a string to a maximum number of characters (not bytes)
///
/// # Arguments
/// * `s` - The string to truncate
/// * `max_chars` - Maximum number of Unicode characters
///
/// # Returns
/// A new String containing at most max_chars characters
pub fn truncate_chars(s: &str, max_chars: usize) -> String {
    s.chars().take(max_chars).collect()
}

/// Safely get a substring by character indices
///
/// # Arguments
/// * `s` - The source string
/// * `start_char` - Starting character index (inclusive)
/// * `end_char` - Ending character index (exclusive)
///
/// # Returns
/// A new String containing the specified character range
pub fn substring_by_chars(s: &str, start_char: usize, end_char: usize) -> String {
    s.chars()
        .skip(start_char)
        .take(end_char.saturating_sub(start_char))
        .collect()
}

/// Check if a string can be safely sliced at a given byte index
pub fn can_slice_at(s: &str, index: usize) -> bool {
    index <= s.len() && s.is_char_boundary(index)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_korean_text_original_bug() {
        // This is the exact string from the bug report
        let text = "뉴스레터를 공유해주세요</p>";

        // This would panic: &text[0..33]
        // Instead, use safe slicing:
        let result = safe_slice(text, 33);

        // Should not panic and should return valid UTF-8
        assert!(!result.is_empty());
        println!("Safe slice result: {}", result);
    }

    #[test]
    fn test_safe_slice_korean() {
        let text = "안녕하세요";

        // Each Korean char will occupy 3 bytes
        assert_eq!(safe_slice(text, 3), "안");
        assert_eq!(safe_slice(text, 4), "안"); // Adjusts down to byte 3
        assert_eq!(safe_slice(text, 6), "안녕");
        assert_eq!(safe_slice(text, 100), "안녕하세요");
    }

    #[test]
    fn test_truncate_chars_korean() {
        let text = "뉴스레터를 공유해주세요";

        assert_eq!(truncate_chars(text, 5), "뉴스레터를");
        assert_eq!(truncate_chars(text, 7), "뉴스레터를 공");  // Space counts as char
        assert_eq!(truncate_chars(text, 8), "뉴스레터를 공유");
        assert_eq!(truncate_chars(text, 12), "뉴스레터를 공유해주세요");
        assert_eq!(truncate_chars(text, 100), "뉴스레터를 공유해주세요");
    }

    #[test]
    fn test_mixed_ascii_korean() {
        let text = "Hello 안녕하세요 World";

        // Character-based truncation
        assert_eq!(truncate_chars(text, 6), "Hello ");
        assert_eq!(truncate_chars(text, 10), "Hello 안녕하세");
        assert_eq!(truncate_chars(text, 16), "Hello 안녕하세요 Worl");

        // Byte-based safe slicing
        assert_eq!(safe_slice(text, 6), "Hello ");
        // "Hello " is 6 bytes, "안" is 3 more = 9 bytes total
        assert_eq!(safe_slice(text, 9), "Hello 안");
    }

    #[test]
    fn test_japanese_text() {
        let text = "こんにちは世界";

        assert_eq!(truncate_chars(text, 5), "こんにちは");
        assert_eq!(truncate_chars(text, 7), "こんにちは世界");

        // Each Japanese char is 3 bytes
        assert_eq!(safe_slice(text, 15), "こんにちは");
    }

    #[test]
    fn test_chinese_text() {
        let text = "你好世界";

        assert_eq!(truncate_chars(text, 2), "你好");
        assert_eq!(truncate_chars(text, 4), "你好世界");

        // Each Chinese char is 3 bytes
        assert_eq!(safe_slice(text, 6), "你好");
    }

    #[test]
    fn test_emoji() {
        let text = "Hello 👋 World 🌍";

        // Emoji can be 4 bytes
        let result = safe_slice(text, 9);
        println!("Emoji slice: {}", result);

        let char_result = truncate_chars(text, 7);
        assert_eq!(char_result, "Hello 👋");
    }

    #[test]
    fn test_substring_by_chars() {
        let text = "뉴스레터를 공유해주세요";

        assert_eq!(substring_by_chars(text, 0, 5), "뉴스레터를");
        assert_eq!(substring_by_chars(text, 5, 7), " 공");
        assert_eq!(substring_by_chars(text, 7, 11), "유해주세");
    }

    #[test]
    fn test_can_slice_at() {
        let text = "안녕";

        assert!(can_slice_at(text, 0));
        assert!(can_slice_at(text, 3)); // After first char
        assert!(!can_slice_at(text, 1)); // Middle of first char
        assert!(!can_slice_at(text, 2)); // Middle of first char
        assert!(can_slice_at(text, 6)); // End of string
    }

    #[test]
    fn test_edge_cases() {
        // Empty string
        assert_eq!(safe_slice("", 10), "");
        assert_eq!(truncate_chars("", 10), "");

        // Single char
        let text = "안";
        assert_eq!(safe_slice(text, 1), "");
        assert_eq!(safe_slice(text, 3), "안");
        assert_eq!(truncate_chars(text, 0), "");
        assert_eq!(truncate_chars(text, 1), "안");

        // ASCII
        let ascii = "Hello";
        assert_eq!(safe_slice(ascii, 3), "Hel");
        assert_eq!(truncate_chars(ascii, 3), "Hel");
    }

    #[test]
    fn test_html_with_korean() {
        // Similar to the bug report
        let html = "<p>뉴스레터를 공유해주세요</p>";

        // Should not panic
        let result = safe_slice(html, 33);
        assert!(!result.is_empty());

        let char_result = truncate_chars(html, 15);
        println!("HTML truncated: {}", char_result);
    }

    #[test]
    fn test_performance_large_string() {
        let korean_text = "안녕하세요".repeat(1000);

        // Should handle large strings efficiently
        let result = truncate_chars(&korean_text, 100);
        assert_eq!(result.chars().count(), 100);

        let byte_result = safe_slice(&korean_text, 300);
        assert!(byte_result.len() <= 300);
    }
}

fn main() {
    // Demonstration of the bug and fix
    println!("=== UTF-8 Safe Slicing Demo ===\n");

    let text = "뉴스레터를 공유해주세요</p>";
    println!("Original text: {}", text);
    println!("Byte length: {}", text.len());
    println!("Char count: {}", text.chars().count());

    println!("\n--- Attempting to slice at byte 33 (would panic) ---");
    println!("Safe slice at byte 33: {}", safe_slice(text, 33));

    println!("\n--- Character-based truncation ---");
    println!("First 11 chars: {}", truncate_chars(text, 11));
    println!("First 5 chars: {}", truncate_chars(text, 5));

    println!("\n--- Mixed content example ---");
    let mixed = "Hello 안녕하세요 World";
    println!("Mixed text: {}", mixed);
    println!("First 10 chars: {}", truncate_chars(mixed, 10));
    println!("Safe slice at 20 bytes: {}", safe_slice(mixed, 20));

    println!("\n--- Multiple languages ---");
    let multilang = "English 한국어 日本語 中文 🌍";
    println!("Multilang: {}", multilang);
    println!("First 15 chars: {}", truncate_chars(multilang, 15));
}
