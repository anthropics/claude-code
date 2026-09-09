# preserve-session

프로젝트 폴더 이름을 바꾸거나 다른 곳으로 옮겨도 이전 Claude Code 대화가 사라지지 않게 해줍니다.

## 데모

https://github.com/user-attachments/assets/05a3dd4b-dfaa-4540-a2f1-e0c2bf6583af

## 왜 필요한가요

Claude Code는 프로젝트 폴더 위치로 대화 기록을 찾습니다. 그래서 폴더 이름을 바꾸거나 다른 곳으로 옮기면 `/resume`에서 이전 대화가 안 보이게 됩니다.

## 해결법 (한 줄)

옮긴 자리에서 `/preserve-session:fix` 한 번 실행하면 끝. 플러그인이 프로젝트마다 고유 번호를 붙여 기억해두기 때문에, 대화 기록을 새 위치로 맞춰줍니다.

## 설치

```
claude plugin install preserve-session
```

설치 후 별도 설정 불필요. 자동으로 활성화됩니다.

**로컬 테스트용:**
```
claude --plugin-dir /path/to/plugins/preserve-session
```

## 어떤 명령어를 써야 하나요?

평소엔 `/preserve-session:fix` 하나면 충분합니다. 나머지는 특수 상황용.

| 이럴 때 | 이 명령어 |
|---------|-----------|
| 프로젝트 이름 바꾸거나 옮겼는데 이전 대화가 안 보일 때 | `/preserve-session:fix` |
| 프로젝트를 복사해놓고, 복사본에 이전 대화 **사본**을 남기고 싶을 때 (원본은 그대로) | `/preserve-session:copy` |
| 프로젝트를 복사해놓고, 이전 대화를 복사본으로 **완전히 옮기고** 싶을 때 (원본은 비워짐) | `/preserve-session:move` |
| 뭔가 이상하다 싶을 때 — 현재 상태 점검 | `/preserve-session:doctor` |
| (선택) 오래된 기록 정리하거나 디스크 공간 비우기 | `/preserve-session:cleanup` |
| 플러그인 지우고 관련 데이터 전부 삭제 | `/preserve-session:uninstall` |

> **`/cleanup`은 꼭 써야 하나요?** — 아니요. Claude Code가 30일 지난 오래된 대화 파일은 알아서 지워줍니다. 그 전에 빨리 디스크 공간을 비우고 싶거나 목록을 깔끔히 유지하고 싶을 때만 쓰면 됩니다. *(v1.3.0에서 추가, v1.3.1에서 한글 경로 사용자 대상 안전 강화)*

> **참고:**
> - ~~`/preserve-session:inherit`~~ 는 v1.2.0부터 의미가 명확한 `copy`와 `move`로 나뉘었습니다. 앞으론 `copy` 또는 `move`를 쓰세요. (`inherit`은 언젠가 완전히 사라집니다.)
> - `/preserve-session:scan` (여러 프로젝트 한꺼번에 등록)은 계획 중이고 아직 나오지 않았습니다.

## 자주 쓰는 흐름

**폴더 이름을 바꾼 뒤:**
```
cd /new/project/name
claude
/preserve-session:fix
```

**프로젝트를 복사한 뒤 (새로 시작하고 원본은 그대로 두고 싶음):**
```
# 아무것도 할 필요 없음 — 복사본에서 claude를 실행하면
# 플러그인이 알아서 새 프로젝트로 등록해줍니다
```

**프로젝트를 복사한 뒤 (복사본에 이전 대화 사본을 두고 싶음):**
```
/preserve-session:fix             # 먼저 새 프로젝트로 등록
/preserve-session:copy            # Claude가 어느 프로젝트에서 가져올지 물어봄
```

**프로젝트를 복사한 뒤 (이전 대화를 복사본으로 완전히 옮기고 원본은 버림):**
```
/preserve-session:fix             # 먼저 새 프로젝트로 등록
/preserve-session:move            # Claude가 어느 프로젝트에서 가져올지 물어봄
```

> `copy`는 복사본을 만들어서 넣어둡니다 — 원본 쪽 대화도 그대로 남아요.
> `move`는 원본에서 대화를 빼서 옮깁니다 — 원본 쪽은 비워집니다.

**현재 상태 확인:**
```
/preserve-session:doctor
```

## doctor 결과 읽는 법

- `~ hook not found in settings.json` — 정상입니다. 설정 파일에 없어도 플러그인이 알아서 처리.
- `✗ path mismatch` — 프로젝트 폴더가 옮겨졌는데 기록이 아직 갱신 안 됨. `/preserve-session:fix` 실행하세요.
- `⚠ slug collision` — 다른 프로젝트와 내부 폴더명이 겹칩니다. 주로 한글·일본어·중국어 등 비 ASCII 경로에서 발생 (아래 전용 섹션 참고).

## 주의사항

- **터미널에서 쓰세요 (VS Code 익스텐션 말고)** — 익스텐션에서는 일부 기능이 안 됩니다. 터미널에서 `claude` 명령으로 실행.
- **`.claude/hash.txt`를 `.gitignore`에 추가하세요** — 팀 프로젝트에서 이 파일을 공유하면 기록이 섞일 수 있습니다.
- **`project-registry.json`은 내 컴퓨터 전용** — 백업하거나 다른 기기로 동기화하지 마세요.
- **`/fix` 실행하는 터미널 외에 다른 Claude Code 세션은 종료 권장** — 동일 프로젝트를 연 다른 세션이 열려 있으면 폴더 이름 바꾸는 도중 충돌 가능. 이미 새 위치에서 별도로 대화를 시작했더라도 플러그인이 자동으로 합쳐줍니다. 남는 옛 폴더는 나중에 `/preserve-session:cleanup`으로 정리 가능.

## 한글/CJK(중국어·일본어)·키릴·아랍어 등 비 ASCII 경로 사용 시

Claude Code는 `[a-zA-Z0-9-]`가 아닌 모든 문자를 `-`로 바꿔서 내부 폴더 이름을 만듭니다. 슬래시(`/`)도 `-`로 바뀌기 때문에 **세그먼트 경계 자체가 사라집니다**. 그 결과:

- 비 ASCII 문자의 **총 개수**와 ASCII 글자 위치가 같으면 서로 다른 경로도 같은 내부 폴더로 매핑됩니다. 예를 들어 `~/외주/app`, `~/개인/app`, `~/仕事/app` 모두 같은 내부 폴더 이름이 됩니다.
- 세그먼트 순서나 길이가 달라도 총 글자 수가 같으면 여전히 충돌합니다. (예: `~/ㅎㅎ/ㅎㅎㅎ` vs `~/ㅎㅎㅎ/ㅎㅎ` → 같은 결과)
- 두 프로젝트의 대화 파일이 같은 폴더에 섞여 저장되고, `/resume` picker에도 섞여서 나타납니다.

### 플러그인이 해주는 것

- 세션 시작 시점과 `/preserve-session:doctor`에서 충돌 감지 + 경고
- 충돌 상황에서 `fix`/`copy`/`move`/`cleanup`이 데이터를 소리 없이 잃지 않도록 차단
- macOS의 NFD/NFC 표기 차이를 내부에서 맞춰주므로, 한글/CJK 경로가 *다른 이유로* 꼬이지 않게 함

### 플러그인이 해주지 **못하는** 것 (Claude Code 본체 이슈 [#40946](https://github.com/anthropics/claude-code/issues/40946))

- Claude Code가 애초에 두 충돌 프로젝트를 같은 폴더에 쓰는 것 자체는 막을 수 없음
- 이미 섞여버린 `/resume` 목록의 프로젝트별 분리도 불가

### 업스트림 수정 전까지 대응 방법

- 충돌이 문제되는 프로젝트는 **ASCII 전용 이름** 사용 (가장 확실)
- 또는 두 프로젝트의 **비 ASCII 문자 총 개수를 다르게**. 세그먼트 순서 바꾸기나 길이만 다르게는 효과 없음 (`/`도 `-`로 바뀌어 세그먼트 경계가 사라지기 때문)
- 각 비 ASCII 프로젝트에서 `/preserve-session:doctor` 한 번씩 돌려 충돌 여부 확인

같은 slug를 공유하는 다른 프로젝트가 없는 **단일 비 ASCII 프로젝트**는 안전하게 써도 됩니다.

## 파일

| 파일 | 위치 | 용도 |
|------|------|------|
| `hash.txt` | `<프로젝트>/.claude/hash.txt` | 프로젝트 고유 번호 |
| `project-registry.json` | `~/.claude/project-registry.json` | 고유 번호 ↔ 현재 경로 매핑 |

## 라이선스

MIT © 2026 SEONGIL WON. [LICENSE](https://github.com/wonbywondev/claude-plugins/blob/main/LICENSE)
