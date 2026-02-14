#!/bin/bash

# UTF-8 Bug Verification Script
# Tests Claude Code with Korean and other multi-byte UTF-8 text

set -e

echo "=== Claude Code UTF-8 Bug Test Script ==="
echo ""

# Create test directory
TEST_DIR="./utf8_test_$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "Created test directory: $TEST_DIR"
echo ""

# Test Case 1: Create file with Korean text
echo "Test 1: Creating file with Korean text (original bug scenario)"
cat > korean_test.txt << 'EOF'
뉴스레터를 공유해주세요</p>
안녕하세요 Claude Code
한글 테스트입니다
EOF

echo "✓ Created korean_test.txt"
cat korean_test.txt
echo ""

# Test Case 2: Create HTML file with Korean content
echo "Test 2: Creating HTML file with Korean content"
cat > korean_newsletter.html << 'EOF'
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>뉴스레터</title>
</head>
<body>
    <h1>뉴스레터를 공유해주세요</h1>
    <p>안녕하세요! Claude Code 사용자 여러분</p>
    <p>이 페이지는 UTF-8 인코딩 테스트용입니다.</p>
</body>
</html>
EOF

echo "✓ Created korean_newsletter.html"
echo ""

# Test Case 3: Create mixed language file
echo "Test 3: Creating mixed language file"
cat > mixed_languages.txt << 'EOF'
English: Hello World
Korean: 안녕하세요
Japanese: こんにちは世界
Chinese: 你好世界
Emoji: Hello 👋 World 🌍
EOF

echo "✓ Created mixed_languages.txt"
cat mixed_languages.txt
echo ""

# Test Case 4: Create file with various CJK characters
echo "Test 4: Creating file with various CJK characters"
cat > cjk_test.txt << 'EOF'
Korean Characters:
가나다라마바사아자차카타파하
ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ

Japanese Characters:
あいうえお
かきくけこ
アイウエオ
カキクケコ

Chinese Characters:
一二三四五六七八九十
甲乙丙丁戊己庚辛壬癸
EOF

echo "✓ Created cjk_test.txt"
echo ""

# Test Case 5: Create long Korean text
echo "Test 5: Creating file with long Korean text"
cat > long_korean.txt << 'EOF'
대한민국의 수도는 서울특별시입니다. 서울은 한강을 중심으로 발달한 도시로, 약 천만 명의 인구가 거주하고 있습니다.
서울의 역사는 매우 깊어 조선시대부터 수도의 역할을 해왔으며, 현재는 정치, 경제, 문화의 중심지입니다.
대표적인 관광지로는 경복궁, 남산타워, 명동, 강남 등이 있습니다.
한국의 전통 음식으로는 김치, 불고기, 비빔밥, 삼겹살 등이 유명합니다.
K-POP과 한국 드라마는 전 세계적으로 큰 인기를 얻고 있으며, 한류 문화의 중심지 역할을 하고 있습니다.
EOF

echo "✓ Created long_korean.txt"
echo ""

# Test Case 6: Create file with exact bug scenario
echo "Test 6: Creating file with exact bug scenario (33 byte boundary)"
# The string "뉴스레터를 공유해주세요</p>" has byte 33 inside '요'
cat > exact_bug.txt << 'EOF'
뉴스레터를 공유해주세요</p>
EOF

echo "✓ Created exact_bug.txt"
echo "Byte length check:"
wc -c exact_bug.txt
echo ""

# Verification function
verify_file() {
    local file=$1
    echo "Verifying: $file"

    # Check if file exists and is valid UTF-8
    if [ -f "$file" ]; then
        echo "  ✓ File exists"

        # Verify UTF-8 encoding
        if file "$file" | grep -q "UTF-8"; then
            echo "  ✓ UTF-8 encoding verified"
        else
            echo "  ⚠ Warning: File may not be UTF-8"
        fi

        # Check byte and character counts
        byte_count=$(wc -c < "$file")
        line_count=$(wc -l < "$file")
        echo "  - Bytes: $byte_count"
        echo "  - Lines: $line_count"
    else
        echo "  ✗ File not found"
    fi
    echo ""
}

# Verify all test files
echo "=== Verifying Test Files ==="
verify_file "korean_test.txt"
verify_file "korean_newsletter.html"
verify_file "mixed_languages.txt"
verify_file "cjk_test.txt"
verify_file "long_korean.txt"
verify_file "exact_bug.txt"

# Test with Claude Code (if available)
echo "=== Testing with Claude Code ==="
if command -v claude &> /dev/null; then
    echo "Claude Code is installed. Testing search functionality..."

    # This would trigger the bug if not fixed
    echo ""
    echo "Test: Searching for Korean text in files"
    echo "Command: grep -r '뉴스레터' ."
    echo ""

    if grep -r '뉴스레터' . 2>&1; then
        echo "✓ grep command succeeded"
    else
        echo "✗ grep command failed (may indicate UTF-8 handling issue)"
    fi

    echo ""
    echo "To test with Claude Code, run:"
    echo "  cd $TEST_DIR"
    echo "  claude"
    echo "  Then try searching for: 뉴스레터를 공유해주세요"
else
    echo "⚠ Claude Code not found in PATH"
    echo "Install Claude Code to run full tests"
fi

echo ""
echo "=== Manual Test Instructions ==="
cat << 'INSTRUCTIONS'

To manually verify the bug fix:

1. Navigate to the test directory:
   cd [test directory path shown above]

2. Start Claude Code:
   claude

3. Try these commands in Claude Code:
   - "Search for 뉴스레터 in this directory"
   - "Show me the contents of korean_test.txt"
   - "Find all Korean text in these files"
   - "Read exact_bug.txt"

4. Expected behavior:
   ✓ Should NOT crash with "byte index is not a char boundary" error
   ✓ Should correctly display Korean text
   ✓ Should handle search results with multi-byte characters

5. If you encounter the panic:
   - Note the exact error message
   - Check which file/operation triggered it
   - Report using: /bug command in Claude Code

INSTRUCTIONS

echo ""
echo "=== Cleanup ==="
echo "To remove test files, run:"
echo "  cd .. && rm -rf $TEST_DIR"
echo ""

echo "Test setup complete!"
