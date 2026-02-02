---
description: Change Savant response language (English, Korean, Japanese, Chinese)
---

# Change Language Setting

$ARGUMENTS

## Your Task

Change the language for all Savant persona responses.

## If No Argument Provided

Use AskUserQuestion to let user select:

```
AskUserQuestion:
- question: "Which language should Savant respond in?"
- header: "Language"
- options:
  - label: "English"
    description: "Responses in English"
  - label: "한국어 (Korean)"
    description: "한국어로 응답합니다"
  - label: "日本語 (Japanese)"
    description: "日本語で応答します"
  - label: "中文 (Chinese)"
    description: "用中文回复"
```

## If Argument Provided

Accept shortcuts:
- `en` or `english` → English
- `kr` or `ko` or `korean` or `한국어` → Korean
- `jp` or `ja` or `japanese` or `日本語` → Japanese
- `ch` or `zh` or `chinese` or `中文` → Chinese

## Response by Language

### English
```
✅ Language set to **English**

All Savant personas will now respond in English.
```

### Korean (한국어)
```
✅ 언어가 **한국어**로 설정되었습니다

모든 Savant 페르소나가 이제 한국어로 응답합니다.
```

### Japanese (日本語)
```
✅ 言語が**日本語**に設定されました

すべてのSavantペルソナが日本語で応答します。
```

### Chinese (中文)
```
✅ 语言已设置为**中文**

所有Savant角色现在将用中文回复。
```

## Important

After language is set, ALL subsequent Savant persona responses (Einstein, Shakespeare, Steve Jobs, Socrates) should be in the selected language. The personas maintain their character but speak in the chosen language.
