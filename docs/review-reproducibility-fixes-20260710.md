# 再現性監査・修正後レビュー

## 結論

既知の実デグレは、修正後の全体回帰試験では再現しない。最終状態の品質gateは212件成功、0件失敗だった。ただし、GitHub Actions本番スケジューラ、外部GitHubへの書き込み、実ユーザー認証を伴う運用試験は実施していないため、「あらゆる環境でデグレがない」とは断言しない。

## 対象

- 基準コミット: `b4fa5f85f3d2e02b47f67ab2e348ce6101fb7b5a`
- 作業worktree: `/Users/naoki/Desktop/code/claude-code/fix-reproducibility-audit`
- ブランチ: `fix/reproducibility-audit`
- コミット: 未作成
- 監査対象: 元監査74論点（CONFIRMED 45、CONDITIONAL 19、REFUTED 10）と修正後の差分

## 追加で実再現したデグレと修正

### ライフサイクル / triage

1. 外部の原投稿者が追記すると `invalid` まで解除され、対象外issueが3日後の自動クローズ対象から外れる問題を再現した。追記時のcleanup対象を `needs-info` / `needs-repro` に限定し、`invalid` は維持するよう修正した。
2. issue作成直後の外部投稿者コメントが、モデル再実行なしでopened triageをcancelする競合を再現した。外部投稿者のrunは同じconcurrency groupで待機させ、`cancel-in-progress` は信頼済み投稿者がモデルを再実行する場合だけ有効にした。
3. triage promptからworkflow所有の `stale` / `autoclose` 操作を削除し、ラベル責務を分離した。

対象テストは8件成功（33 assertions）、automation全体は51件成功（187 assertions）。`stale` 付与中のコメント競合は既存fixtureを含む9件およびautomation全体で再確認し、再現しなかった。

### Ralph state / lock

同じパスを別directoryへ置換した場合のprompt再送、SIGKILL後のstale lock、PID再利用、ownerless/malformed lock、遅延owner発行とreclaimの競合を実再現した。device:inode、process start identity、atomic reclaim、ownerless lockのgrace/snapshotを導入し、data-safety 54件が成功した。

### Hookify shell到達性

`false && (npm test)`、`true || (npm test)`、inline comment後の改行、backslash改行を誤判定する経路を再現した。到達可能性の継承、改行保持、shell line continuation処理を修正し、Hookify 23件と追加matrixが成功した。

## 検証結果

```text
scripts/test-repository.sh: 212 pass / 0 fail
  Bun automation                 51
  Hookify                        23
  data-safety                    54
  developer-experience           30
  validator/security              50
  quality-gate                    4
```

- `git diff --check`: 成功
- shell syntax、Python AST、JSON、workflow YAML、agent frontmatter: 成功
- Claude Code `2.1.199` 実CLIでmarketplaceと全plugin manifestを `plugin validate --strict`: 成功
- 変更後marketplaceを別名fixtureとして隔離登録し、13 pluginを実CLIでinstall/list: 成功
- devcontainer Dockerfile実ビルド: 成功（`node:22` arm64、Claude Code `2.1.199`導入）
- ビルド済みコンテナ内 `claude --version`: `2.1.199 (Claude Code)`
- コンテナ内 `/usr/local/bin/init-firewall.sh`（NET_ADMIN/NET_RAW付き）: firewall verification passed
- Claude Code packageのnpm registry存在確認: `@anthropic-ai/claude-code@2.1.199`

## スクリプト脆弱性スキャン

`skill-script-vuln-check` の最終raw結果は57 script、Critical 0、High 41、Medium 0、Low 1だった。Highはセキュリティ説明文・validator fixture/assertion・テストが実行するworkflow断片など、検出器が危険語を文字列として検出したものを手動確認した結果、実効Critical/Highは0。Lowは、呼び出し側でstrict modeを保証している意図的なlibrary scriptだった。raw結果は `docs/review-skill-script-vuln-20260710-final.md` / `.json` に保存した。

## 残留する制約・未実施

- GitHub Actions本番run、外部repositoryへのmutation、Statsig/Anthropic APIの実送信は未実施。全てfixture、HTTP mock、隔離CLIで検証した。
- Docker buildは実施済みだが、devcontainerをVS Codeからattachする操作までは行っていない。
- Statsigの一時的なHTTP 500後のcurl retryは、サーバー側idempotencyが提供されない限り重複イベントの可能性が残る。
- firewallのDNS解決後IP許可は、共有CDN IPやDNS変更時のhostname/SNI保証までは提供しない。
- Hookify parserは任意の複雑なshell（command substitutionや独自wrapper等）の完全なshell解析器ではない。未知構文は安全側に倒す設計とした。

仕様照合には [Hooks](https://code.claude.com/docs/en/hooks)、[Tools reference](https://code.claude.com/docs/en/tools-reference)、[Plugins reference](https://code.claude.com/docs/en/plugins-reference)、[GitHub Actions concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) を使用した。
