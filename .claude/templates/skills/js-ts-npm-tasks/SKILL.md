---
name: JS/TS NPM Tasks Interpreter
description: >
  讀取 package.json 與相關設定，解讀 scripts 的用途、建置與測試流程，
  並在需要執行、除錯或最佳化時提供建議（不直接執行命令）。
allowed-tools: Read(*), Grep(*), Glob(*)
---

# JS/TS NPM Tasks Interpreter

## 任務
- 解析 `package.json` scripts 與常見工具鏈（tsc、eslint、vitest/jest、vite/webpack）
- 指出依賴關係、常見錯誤與最佳實務（例如區分 dev/prod、cache）

## 輸出
- 任務對照表（script → 用途）＋ 建議步驟或風險提示（純文字）

## 使用情境
- 「說明此 repo 的 npm scripts、如何跑測試/建置？」
- 「幫我找出腳本間的依賴與可能的最佳化」

