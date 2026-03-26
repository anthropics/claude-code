# preserve-session

프로젝트 디렉토리 이름 변경, 이동, 복사 시에도 Claude Code 세션 히스토리를 보존합니다.

## 문제

Claude Code는 디렉토리 경로를 기준으로 프로젝트를 식별합니다. 프로젝트 디렉토리를 이름 변경하거나 이동하면 이전 세션 히스토리에 접근할 수 없게 됩니다.

## 동작 방식

각 프로젝트에 `.claude/hash.txt`에 저장되는 경로 독립적인 UUID가 부여됩니다. 글로벌 레지스트리(`~/.claude/project-registry.json`)가 각 UUID를 현재 경로에 매핑합니다. 경로가 변경되면 `/preserve-session:fix`를 실행하여 내부 세션 폴더 이름을 새 경로에 맞게 변경하고, 이전 세션에 대한 접근을 복원합니다.

## 설치

```
claude plugin install preserve-session
```

`SessionStart` 훅이 플러그인에 포함되어 설치 시 자동으로 활성화됩니다. 별도 설정이 필요하지 않습니다.

**로컬 테스트:**
```
claude --plugin-dir /path/to/plugins/preserve-session
```

## 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/preserve-session:fix` | 이름 변경 또는 이동 후 세션 복구. 복사 감지도 처리 |
| `/preserve-session:inherit` | 다른 프로젝트의 세션 히스토리를 현재 프로젝트로 복사 |
| `/preserve-session:doctor` | 현재 프로젝트의 preserve-session 상태 진단 |
| `/preserve-session:scan` | _(예정)_ 지정한 디렉토리에서 미등록 프로젝트를 탐색하여 일괄 초기화 |

## 주요 워크플로우

**디렉토리 이름 변경 후:**
```
cd /new/project/name
claude
/preserve-session:fix
```

**프로젝트 복사 후 (새로 시작, 원본 보호):**
```
# 별도 조치 불필요 — /fix 실행 시 자동으로 독립 프로젝트로 등록됨
```

**프로젝트 복사 후 (이전 세션 이어받기):**
```
/preserve-session:fix                          # 먼저 독립 복사본으로 등록
/preserve-session:inherit                      # 등록된 프로젝트 목록 표시
# Claude가 어느 프로젝트에서 이어받을지 묻고, 아래를 실행:
# /preserve-session:inherit --from /original/path
```

**현재 상태 확인:**
```
/preserve-session:doctor
```

## doctor 출력 해석

- **Hook not in settings.json** — `settings.json`에 없어도 훅은 활성 상태입니다.
- **Path mismatch / stale registry entry** — `/preserve-session:fix`를 실행하면 레지스트리를 현재 경로로 업데이트하고 stale 항목을 정리합니다.

## 주의사항

- **VS Code 익스텐션보다 터미널 사용을 권장합니다** — 플러그인 커맨드와 세션 히스토리 조회는 VS Code 익스텐션에서 완전히 지원되지 않습니다. 터미널에서 `claude`를 사용하세요.
- **`.claude/hash.txt`를 `.gitignore`에 추가 권장** — 팀 프로젝트에서 여러 사람이 같은 UUID를 공유하면 레지스트리 충돌 가능
- **`project-registry.json`은 로컬 전용** — 백업 또는 동기화 도구에 포함하지 말 것
- **`/fix` 실행 전 Claude Code 종료 권장** — 세션 폴더 이름 변경 중 충돌 방지

## 파일

| 파일 | 위치 | 용도 |
|------|------|------|
| `hash.txt` | `<project>/.claude/hash.txt` | 프로젝트 고유 UUID |
| `project-registry.json` | `~/.claude/project-registry.json` | 해시 → 현재 경로 매핑 |
