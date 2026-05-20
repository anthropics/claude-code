import json
from pathlib import Path

raw_path = Path('UPSTREAM_ISSUES_TEST.json')
output_path = Path('UPSTREAM_ISSUES.json')


def normalize_concatenated_arrays(text: str) -> str:
    normalized = []
    depth = 0
    in_string = False
    escape = False

    for idx, char in enumerate(text):
        if escape:
            normalized.append(char)
            escape = False
            continue

        if char == '\\':
            normalized.append(char)
            escape = True
            continue

        if char == '"':
            normalized.append(char)
            in_string = not in_string
            continue

        if in_string:
            normalized.append(char)
            continue

        if char == '[':
            depth += 1
        elif char == ']':
            depth -= 1

        normalized.append(char)

        if char == ']' and idx + 1 < len(text) and text[idx + 1] == '[' and depth == 1:
            normalized.append(',')

    return ''.join(normalized)


text = raw_path.read_text(encoding='utf-8', errors='replace')
text = normalize_concatenated_arrays(text)

data = json.loads(text)

if isinstance(data, list) and data and isinstance(data[0], list):
    issues = [issue for page in data for issue in page if 'pull_request' not in issue]
elif isinstance(data, list):
    issues = [issue for issue in data if 'pull_request' not in issue]
else:
    raise RuntimeError('Unexpected JSON structure after normalization')

output_path.write_text(json.dumps(issues, indent=2), encoding='utf-8')
print(f'Wrote {len(issues)} issues to {output_path}')
