# git-branch-info

Makes git branch information always visible in Claude Code sessions.

## What it does

- **Session Start**: Shows current branch, dirty state, and ahead/behind status when you start a session
- **Every Prompt**: Injects the current branch as context so Claude always knows which branch you're on
- **`/branch` command**: On-demand detailed git status (branches, commits, upstream tracking)

## Why

Claude Code doesn't natively show which git branch you're working on. This plugin fills that gap by ensuring branch context is always present — similar to how a terminal prompt shows your branch.

## Install

Copy or symlink this plugin directory into your Claude Code plugins path.
