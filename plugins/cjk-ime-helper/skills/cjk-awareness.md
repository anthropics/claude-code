# CJK Awareness Skill

When you detect that the user is communicating in a CJK language (Chinese, Japanese, Korean, Vietnamese), be aware of the following:

## IME Input Limitations

The user may be experiencing invisible character composition in the terminal input field. This is a known limitation of React Ink's TextInput in terminal raw mode.

**Signs the user may be affected:**
- Short, fragmented messages (typing blind is difficult)
- Pasted text blocks (using clipboard workaround)
- Mixing English commands with CJK context
- Asking about input or typing issues

## How to Help

1. **Be patient** with potentially garbled or incomplete CJK input
2. **Suggest /cjk-paste** if the user seems to struggle with input
3. **Respond in the user's language** - they can read CJK output even if input is difficult
4. **Offer English alternatives** for complex commands when appropriate

## Trigger

This skill activates automatically when:
- The session locale is detected as CJK
- The user types in CJK characters
- The user mentions IME, input, or typing issues
