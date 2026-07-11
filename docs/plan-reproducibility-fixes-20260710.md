# 再現性監査に基づく修正計画

## 目的

監査報告 `/Users/naoki/code/claude-code/docs/review-reproducibility-audit-20260710.md` で分類した74論点のうち、確定した45件と、安全側へ決定的に改善できる高リスクの条件付き論点を修正する。反証済み10件には変更を加えない。

対象ブランチは `fix/reproducibility-audit`、作業worktreeは `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit` とする。

## 実装原則

- 外部GitHub repository、Statsig、Anthropic APIへ変更を送らない。外部作用はfixtureとHTTP mockで検証する。
- データ削除、任意コマンド、認可境界、失敗の成功偽装を最優先する。
- 実装は領域別の`code-implementer-codex`へ分割し、メインセッションは設計、競合解消、差分監査、受け入れ検証を担当する。このセッションでユーザーから明示された`AGENTS.md`相当の指示は`code-implementer-codex`を必須としており、より一般的なグローバル`~/.claude/CLAUDE.md`の`code-implementer-claude`指定より新しく具体的であるため、前者を適用する。
- 各不具合は、修正前に失敗し修正後に成功する回帰testを可能な限り追加する。
- 新しいframeworkは導入せず、Bash、Python標準ライブラリ、Bunの組み込みtest runnerを優先する。
- 既存の公開interfaceとplugin配置を維持し、互換性を壊す変更は明示的なmigrationなしに行わない。
- plugin versionは内容変更を統合した最後に一度だけ更新し、marketplaceと各manifestを一致させる。

## バッチ1: データ保全・任意実行・firewall

担当範囲: `plugins/ralph-wiggum/**`、`plugins/commit-commands/commands/clean_gone.md`、`.devcontainer/init-firewall.sh`。

1. Ralphのcommand展開を安全な引数境界へ変更し、shell metacharacterをデータとして渡す。
2. Ralph stateをsession単位に分離し、symlinkを拒否し、Stop hookへ明示的なstate pathを結線する。
3. `stop_hook_active`、completion promiseの完全tag一致、壊れたJSONL transcriptの保守的処理を修正する。
4. `clean_gone`はupstream情報を機械可読形式で判定し、dirty worktreeを強制削除しない。cleanであっても未merge・未pushの固有commitを持つbranchは`git branch -d`相当の安全性を確認できない限りskipして警告し、`-D`へfallbackしない。この保護を回帰testへ含める。
5. firewallは初期policyを先に閉じ、失敗時もfail-closedにし、IPv4/IPv6を対称化する。DNS、SSH、host networkの許可先を必要最小限にする。
6. 上記を一時Git repository、symlink、command stubで駆動する回帰testを追加する。

## バッチ2: Hookify契約修復

担当範囲: `plugins/hookify/**`。

1. versioned marketplace cacheでも`hookify.core`をimportできるpackage-relative bootstrapへ変更する。
2. hook payloadの`cwd`をrule探索rootとして使用する。
3. Write/Editのsimple file ruleが各現行fieldを正しく検査するよう統一する。
4. UserPromptSubmit、PostToolUse、Stopの入力fieldとblock outputを現行hook契約へ合わせる。
5. `stop_hook_active`による再入防止を実装する。
6. `require-tests` exampleのOR条件を構造化し、実行済みtestを認識させる。
7. versioned install、subdirectory CWD、全event payloadを直接駆動するPython回帰testを追加する。

## バッチ3: GitHub automation

担当範囲: `scripts/*.ts`、`scripts/*.sh`、関連`.github/workflows/**`。

1. GitHub一覧取得をLink headerまたは明示cursorで最後まで走査し、固定page上限とlarge dataset failureを除去する。
2. issue一覧からPull Requestを除外し、既存labelを保持する。
3. comment、reaction、event、mutation対象にもpaginationを適用し、走査中の配列変更で対象を飛ばさない。
4. close/comment、lock/comment等の部分成功を再実行可能にし、失敗時は非ゼロ終了する。
5. backfillの`DAYS_BACK`、repository、番号範囲、default refを入力から解決し、204 No Contentを成功扱いする。
6. botの送信者とduplicate targetを厳密に検証する。
7. workflow prompt injection、shell interpolation、concurrency cancellationを最小権限・安全なenv受け渡しへ変更する。
8. Statsig event名、JSON生成、時刻型、成功条件を修正する。
9. Bun mock serverでpagination、HTTP 204/404/422/500、部分成功、再実行を検証するtestを追加する。

## バッチ4: validator・agent・security guidance

担当範囲: `plugins/plugin-dev/**`、`plugins/pr-review-toolkit/agents/**`、`plugins/security-guidance/**`。

1. hook validatorがtop-level wrapperを理解し、現行event、matcher省略、command/http/prompt/agent hook typeを検証するよう修正する。
2. hook test helperとexampleを現行payload/output/exit semanticsへ更新する。
3. 10件のagent frontmatterを厳密YAMLとして有効化する。
4. agent validatorを実YAML parserベースへ変更し、optional fieldを必須扱いしない。
5. security reminderを文字列包含から境界を持つ検査へ変更し、安全コードの誤検知、空白・大小文字・Windows path・複数findingの見逃しを修正する。
6. validator fixtureとsecurity hook入出力testを追加する。

## バッチ5: 開発支援plugin・PowerShell・migration

担当範囲: `plugins/code-review/**`、`plugins/feature-dev/**`、`plugins/agent-sdk-dev/**`、`plugins/claude-opus-4-5-migration/**`、`Script/**`。

1. code-reviewの全agent findingを同じ検証・集約経路へ通し、未bundle MCP依存時は明示的にfallbackする。
2. review commandは既定でread-onlyにし、編集は明示option時だけ許可する。
3. feature-devのtool allowlistを現行名称へ更新する。
4. PowerShellで全native commandの終了コードを検査し、失敗時に非ゼロ終了する。
5. Opus 4.1 source ID、effort SDK例、適用条件の矛盾を公式仕様へ合わせる。
6. Python Agent SDK要件を3.10以上へ合わせ、TypeScript templateへ実行依存を明示する。
7. 文書主体の変更は静的contract testで重要文字列とfrontmatterを検証する。

## バッチ6: 品質gate・version整合

1. repository全体の回帰test runnerを追加する。
2. shell syntax、Python compile、JSON、厳密YAML、automation test、hook testをPull Requestで実行する品質workflowを追加する。
3. 変更したpluginのmanifest versionを上げ、marketplace versionと一致させる。
4. 全差分に対してsecurity、失敗時挙動、外部mutation不在、後方互換性をメインセッションで再監査する。

## 受け入れ条件

- 監査でCONFIRMEDだった各論点に、修正差分または「仕様上変更しない」根拠が対応している。
- 追加した回帰testがすべて成功する。
- 全shell scriptが`bash -n`、全Pythonがcompile、全JSONとworkflow YAMLがparseを通る。
- 不正だったagent frontmatter 10件を含む全agent定義が厳密YAMLでparseできる。
- GitHub automationのtestは外部サービスへ書き込まず、paginationと失敗終了を再現する。
- Ralph、Hookify、validator、security hookは実際のCLI入力を通すE2Eで期待挙動を確認する。
- 未検証のruntime制約が残る場合、成功と偽らず、対象と代替検証を最終報告へ記載する。

## 実行結果（2026-07-10〜11）

- 追加で実再現したライフサイクル2件、Ralph lock/state 5経路、Hookify shell到達性4経路を修正し、失敗先行回帰testを追加した。
- `scripts/test-repository.sh` は最終状態で212件成功、0件失敗。
- Claude Code 2.1.199実CLIのmarketplace/plugin strict validation、13 pluginの隔離install、devcontainer実ビルド、コンテナ内firewall検証を完了した。
- GitHub Actions本番run、外部mutation、実ユーザー認証は未実施。詳細は `docs/review-reproducibility-fixes-20260710.md` に記録した。
- 製品コードの変更は`change-verify` skillで実駆動し、`code-review` skillで重大度順に監査する。
