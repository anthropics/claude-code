#!/usr/bin/env python3
"""End-to-end regression tests for Hookify command hooks."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest


PLUGIN_SOURCE = Path(__file__).resolve().parents[1]


class HookifyHookTests(unittest.TestCase):
    """Drive each hook through stdin as Claude Code does."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)

        temp_root = Path(self.temp_dir.name)
        self.installed_plugin = (
            temp_root / 'cache' / 'official' / 'hookify' / '0.1.0'
        )
        shutil.copytree(PLUGIN_SOURCE, self.installed_plugin)

        self.project = temp_root / 'project'
        self.rules_dir = self.project / '.claude'
        self.rules_dir.mkdir(parents=True)
        self.process_cwd = self.project / 'src' / 'nested'
        self.process_cwd.mkdir(parents=True)
        self.transcript = self.project / 'transcript.jsonl'

    def write_rule(self, name, content):
        rule_path = self.rules_dir / f'hookify.{name}.local.md'
        rule_path.write_text(
            textwrap.dedent(content).lstrip(), encoding='utf-8'
        )
        return rule_path

    def run_hook(
        self,
        hook_name,
        payload,
        extra_env=None,
        timeout=None,
        return_completed=False,
    ):
        environment = os.environ.copy()
        environment.pop('CLAUDE_PROJECT_DIR', None)
        environment['CLAUDE_PLUGIN_ROOT'] = str(self.installed_plugin)
        for key, value in (extra_env or {}).items():
            if value is None:
                environment.pop(key, None)
            else:
                environment[key] = value
        completed = subprocess.run(
            [
                sys.executable,
                str(self.installed_plugin / 'hooks' / f'{hook_name}.py'),
            ],
            input=json.dumps(payload),
            text=True,
            cwd=self.process_cwd,
            env=environment,
            capture_output=True,
            check=False,
            timeout=timeout,
        )
        self.assertEqual(0, completed.returncode, completed.stderr)
        self.assertTrue(completed.stdout.strip(), completed.stderr)
        result = json.loads(completed.stdout)
        self.assertNotIn('Hookify import error', result.get('systemMessage', ''))
        if return_completed:
            return result, completed
        return result

    def test_frontmatter_delimiter_must_be_a_complete_line(self):
        self.write_rule(
            'embedded-delimiter',
            r'''
            ---
            name: embedded-delimiter-rule
            enabled: true
            event: bash
            pattern: danger---zone
            action: block
            ---

            Embedded delimiter pattern matched.
            ''',
        )
        payload = self.base_payload('PreToolUse')
        payload.update(
            {
                'tool_name': 'Bash',
                'tool_input': {'command': 'echo danger---zone'},
            }
        )

        result = self.run_hook('pretooluse', payload)

        self.assertEqual(
            'deny', result['hookSpecificOutput']['permissionDecision']
        )
        self.assertIn(
            'Embedded delimiter pattern matched.',
            result['hookSpecificOutput']['permissionDecisionReason'],
        )

    def test_malformed_rule_does_not_disable_a_valid_blocking_rule(self):
        self.write_rule(
            'valid-block',
            r'''
            ---
            name: valid-block-rule
            enabled: true
            event: bash
            pattern: DANGER
            action: block
            ---

            Valid rule still blocks.
            ''',
        )
        self.write_rule(
            'malformed-matcher',
            r'''
            ---
            name: malformed-matcher-rule
            enabled: true
            event: bash
            tool_matcher: true
            pattern: DANGER
            action: warn
            ---

            Invalid matcher type.
            ''',
        )
        payload = self.base_payload('PreToolUse')
        payload.update(
            {
                'tool_name': 'Bash',
                'tool_input': {'command': 'echo DANGER'},
            }
        )

        result = self.run_hook('pretooluse', payload)

        self.assertEqual(
            'deny', result['hookSpecificOutput']['permissionDecision']
        )
        self.assertIn(
            'Valid rule still blocks.',
            result['hookSpecificOutput']['permissionDecisionReason'],
        )

    def test_invalid_action_is_reported_and_excluded_instead_of_failing_open(self):
        self.write_rule(
            'typo-action',
            r'''
            ---
            name: typo-action-rule
            enabled: true
            event: bash
            pattern: rm\s+-rf
            action: blok
            ---

            This typo must never become a warning-only rule.
            ''',
        )
        payload = self.base_payload('PreToolUse')
        payload.update(
            {
                'tool_name': 'Bash',
                'tool_input': {'command': 'rm -rf build'},
            }
        )

        result, completed = self.run_hook(
            'pretooluse', payload, return_completed=True
        )

        self.assertEqual({}, result)
        self.assertIn('Warning: Malformed rule file', completed.stderr)
        self.assertIn("'action' must be one of", completed.stderr)
        self.assertIn("'blok'", completed.stderr)

    def test_invalid_regex_in_block_rule_fails_closed(self):
        self.write_rule(
            'invalid-block-regex',
            r'''
            ---
            name: invalid-block-regex-rule
            enabled: true
            event: bash
            pattern: "["
            action: block
            ---

            This rule has an invalid regular expression.
            ''',
        )
        payload = self.base_payload('PreToolUse')
        payload.update(
            {
                'tool_name': 'Bash',
                'tool_input': {'command': 'rm -rf build'},
            }
        )

        result = self.run_hook('pretooluse', payload)

        self.assertEqual(
            'deny', result['hookSpecificOutput']['permissionDecision']
        )
        self.assertIn(
            'invalid regular expression',
            result['hookSpecificOutput']['permissionDecisionReason'],
        )

    def test_invalid_event_and_operator_are_reported_and_excluded(self):
        self.write_rule(
            'typo-event',
            r'''
            ---
            name: typo-event-rule
            enabled: true
            event: bas
            pattern: DANGER
            action: block
            ---

            Invalid event.
            ''',
        )
        self.write_rule(
            'typo-operator',
            r'''
            ---
            name: typo-operator-rule
            enabled: true
            event: bash
            action: block
            conditions:
              - field: command
                operator: contain
                pattern: DANGER
            ---

            Invalid operator.
            ''',
        )
        payload = self.base_payload('PreToolUse')
        payload.update(
            {
                'tool_name': 'Bash',
                'tool_input': {'command': 'echo DANGER'},
            }
        )

        result, completed = self.run_hook(
            'pretooluse', payload, return_completed=True
        )

        self.assertEqual({}, result)
        self.assertIn("'event' must be one of", completed.stderr)
        self.assertIn("'bas'", completed.stderr)
        self.assertIn("condition 'operator' must be one of", completed.stderr)
        self.assertIn("'contain'", completed.stderr)

    def test_all_documented_rule_values_remain_supported(self):
        script = textwrap.dedent(
            '''
            from core.config_loader import Condition, Rule

            for event in ('bash', 'file', 'stop', 'prompt', 'all'):
                Rule.from_dict({'event': event}, 'message')
            for action in ('warn', 'block'):
                Rule.from_dict({'action': action}, 'message')
            for operator in (
                'regex_match', 'contains', 'equals', 'not_contains',
                'starts_with', 'ends_with',
            ):
                Condition.from_dict({
                    'field': 'command',
                    'operator': operator,
                    'pattern': 'value',
                })
            '''
        )

        completed = subprocess.run(
            [sys.executable, '-c', script],
            cwd=self.installed_plugin,
            text=True,
            capture_output=True,
            check=False,
        )

        self.assertEqual(0, completed.returncode, completed.stderr)

    def test_pathological_regex_cannot_exhaust_the_hook_timeout(self):
        self.write_rule(
            'pathological-regex',
            r'''
            ---
            name: pathological-regex-rule
            enabled: true
            event: bash
            pattern: ^(a+)+$
            action: warn
            ---

            Pathological regex matched.
            ''',
        )
        payload = self.base_payload('PreToolUse')
        payload.update(
            {
                'tool_name': 'Bash',
                'tool_input': {'command': ('a' * 30) + '!'},
            }
        )

        result = self.run_hook('pretooluse', payload, timeout=1)

        self.assertEqual({}, result)

    def test_timed_out_block_regex_fails_closed(self):
        self.write_rule(
            'pathological-block-regex',
            r'''
            ---
            name: pathological-block-regex-rule
            enabled: true
            event: bash
            pattern: ^(a+)+$
            action: block
            ---

            Pathological block regex.
            ''',
        )
        payload = self.base_payload('PreToolUse')
        payload.update(
            {
                'tool_name': 'Bash',
                'tool_input': {'command': ('a' * 30) + '!'},
            }
        )

        result = self.run_hook('pretooluse', payload, timeout=1)

        self.assertEqual(
            'deny', result['hookSpecificOutput']['permissionDecision']
        )
        self.assertIn(
            'evaluation timed out',
            result['hookSpecificOutput']['permissionDecisionReason'],
        )

    def base_payload(self, event_name):
        return {
            'session_id': 'test-session',
            'transcript_path': str(self.transcript),
            'cwd': str(self.project),
            'permission_mode': 'default',
            'hook_event_name': event_name,
        }

    def test_pretooluse_loads_versioned_install_rules_from_payload_cwd(self):
        self.write_rule(
            'console-log',
            r'''
            ---
            name: warn-console-log
            enabled: true
            event: file
            pattern: console\.log\(
            action: warn
            ---

            Console log detected.
            ''',
        )

        for tool_name, tool_input in [
            (
                'Write',
                {'file_path': 'example.js', 'content': 'console.log("write")'},
            ),
            (
                'Edit',
                {
                    'file_path': 'example.js',
                    'old_string': 'before',
                    'new_string': 'console.log("edit")',
                },
            ),
        ]:
            with self.subTest(tool_name=tool_name):
                payload = self.base_payload('PreToolUse')
                payload.update({'tool_name': tool_name, 'tool_input': tool_input})
                result = self.run_hook('pretooluse', payload)
                self.assertIn('Console log detected.', result['systemMessage'])

    def test_all_event_simple_pattern_normalizes_supported_payload_content(self):
        self.write_rule(
            'all-events',
            r'''
            ---
            name: all-events-rule
            enabled: true
            event: all
            pattern: DANGER
            action: warn
            ---

            All-event content matched.
            ''',
        )
        self.transcript.write_text(
            '{"type":"assistant","message":"DANGER in transcript"}\n',
            encoding='utf-8',
        )

        cases = [
            (
                'bash-command',
                'pretooluse',
                {
                    **self.base_payload('PreToolUse'),
                    'tool_name': 'Bash',
                    'tool_input': {'command': 'echo DANGER'},
                },
            ),
            (
                'write-content',
                'pretooluse',
                {
                    **self.base_payload('PreToolUse'),
                    'tool_name': 'Write',
                    'tool_input': {
                        'file_path': 'example.py',
                        'content': 'DANGER in write content',
                    },
                },
            ),
            (
                'edit-new-string',
                'pretooluse',
                {
                    **self.base_payload('PreToolUse'),
                    'tool_name': 'Edit',
                    'tool_input': {
                        'file_path': 'example.py',
                        'old_string': 'safe',
                        'new_string': 'DANGER in edit content',
                    },
                },
            ),
            (
                'multiedit-new-strings',
                'pretooluse',
                {
                    **self.base_payload('PreToolUse'),
                    'tool_name': 'MultiEdit',
                    'tool_input': {
                        'file_path': 'example.py',
                        'edits': [
                            {
                                'old_string': 'safe',
                                'new_string': 'DANGER in multi-edit content',
                            }
                        ],
                    },
                },
            ),
            (
                'notebook-new-source',
                'pretooluse',
                {
                    **self.base_payload('PreToolUse'),
                    'tool_name': 'NotebookEdit',
                    'tool_input': {
                        'notebook_path': 'analysis.ipynb',
                        'new_source': 'DANGER in notebook source',
                        'cell_id': 'cell-1',
                        'cell_type': 'code',
                        'edit_mode': 'replace',
                    },
                },
            ),
            (
                'user-prompt',
                'userpromptsubmit',
                {
                    **self.base_payload('UserPromptSubmit'),
                    'prompt': 'DANGER in user prompt',
                },
            ),
            (
                'stop-transcript',
                'stop',
                {
                    **self.base_payload('Stop'),
                    'stop_hook_active': False,
                },
            ),
        ]

        for case_name, hook_name, payload in cases:
            with self.subTest(case=case_name):
                result = self.run_hook(hook_name, payload)
                self.assertIn(
                    'All-event content matched.',
                    result.get('systemMessage', ''),
                    result,
                )

    def test_notebook_edit_file_rules_use_official_fields_pre_and_post(self):
        self.write_rule(
            'notebook-edit',
            r'''
            ---
            name: notebook-edit-rule
            enabled: true
            event: file
            action: warn
            conditions:
              - field: file_path
                operator: regex_match
                pattern: analysis\.ipynb$
              - field: new_text
                operator: contains
                pattern: DANGER
            ---

            Notebook edit matched.
            ''',
        )

        for hook_name, hook_event_name in [
            ('pretooluse', 'PreToolUse'),
            ('posttooluse', 'PostToolUse'),
        ]:
            with self.subTest(hook=hook_name):
                payload = self.base_payload(hook_event_name)
                payload.update(
                    {
                        'tool_name': 'NotebookEdit',
                        'tool_input': {
                            'notebook_path': 'notebooks/analysis.ipynb',
                            'new_source': 'DANGER in notebook source',
                            'cell_id': 'cell-1',
                            'cell_type': 'code',
                            'edit_mode': 'replace',
                        },
                    }
                )
                result = self.run_hook(hook_name, payload)
                self.assertIn(
                    'Notebook edit matched.',
                    result.get('systemMessage', ''),
                    result,
                )

    def test_unknown_tool_does_not_load_bash_rules_pre_or_post(self):
        self.write_rule(
            'bash-only',
            r'''
            ---
            name: bash-only-rule
            enabled: true
            event: bash
            pattern: DANGER
            action: warn
            ---

            Bash-only rule matched.
            ''',
        )
        self.write_rule(
            'all-tools',
            r'''
            ---
            name: all-tools-rule
            enabled: true
            event: all
            action: warn
            conditions:
              - field: command
                operator: contains
                pattern: DANGER
            ---

            All-tools rule matched.
            ''',
        )

        for hook_name, hook_event_name in [
            ('pretooluse', 'PreToolUse'),
            ('posttooluse', 'PostToolUse'),
        ]:
            with self.subTest(hook=hook_name):
                payload = self.base_payload(hook_event_name)
                payload.update(
                    {
                        'tool_name': 'CustomTool',
                        'tool_input': {'command': 'echo DANGER'},
                    }
                )
                result = self.run_hook(hook_name, payload)
                self.assertIn(
                    'All-tools rule matched.',
                    result.get('systemMessage', ''),
                    result,
                )
                self.assertNotIn(
                    'Bash-only rule matched.',
                    result.get('systemMessage', ''),
                    result,
                )

    def test_project_dir_environment_wins_over_nested_git_root(self):
        self.write_rule(
            'project-root',
            r'''
            ---
            name: project-root-rule
            enabled: true
            event: bash
            pattern: echo project-root
            action: warn
            ---

            Project root rule loaded.
            ''',
        )
        subprocess.run(
            ['git', 'init', '-q', str(self.process_cwd)],
            check=True,
            capture_output=True,
        )
        payload = self.base_payload('PreToolUse')
        payload.update(
            {
                'cwd': str(self.process_cwd),
                'tool_name': 'Bash',
                'tool_input': {'command': 'echo project-root'},
            }
        )

        result = self.run_hook(
            'pretooluse',
            payload,
            extra_env={'CLAUDE_PROJECT_DIR': str(self.project)},
        )

        self.assertIn('Project root rule loaded.', result['systemMessage'])

    def test_git_top_level_is_used_when_project_dir_is_invalid(self):
        self.write_rule(
            'git-root',
            r'''
            ---
            name: git-root-rule
            enabled: true
            event: bash
            pattern: echo git-root
            action: warn
            ---

            Git root rule loaded.
            ''',
        )
        subprocess.run(
            ['git', 'init', '-q', str(self.project)],
            check=True,
            capture_output=True,
        )
        payload = self.base_payload('PreToolUse')
        payload.update(
            {
                'cwd': str(self.process_cwd),
                'tool_name': 'Bash',
                'tool_input': {'command': 'echo git-root'},
            }
        )

        result = self.run_hook(
            'pretooluse',
            payload,
            extra_env={
                'CLAUDE_PROJECT_DIR': str(self.project / 'missing-directory')
            },
        )

        self.assertIn('Git root rule loaded.', result['systemMessage'])

    def test_pretooluse_block_uses_permission_decision_contract(self):
        self.write_rule(
            'dangerous-command',
            r'''
            ---
            name: block-dangerous-command
            enabled: true
            event: bash
            pattern: rm\s+-rf
            action: block
            ---

            Destructive command blocked.
            ''',
        )
        payload = self.base_payload('PreToolUse')
        payload.update(
            {
                'tool_name': 'Bash',
                'tool_input': {'command': 'rm -rf build'},
            }
        )

        result = self.run_hook('pretooluse', payload)

        hook_output = result['hookSpecificOutput']
        self.assertEqual('PreToolUse', hook_output['hookEventName'])
        self.assertEqual('deny', hook_output['permissionDecision'])
        self.assertIn(
            'Destructive command blocked.',
            hook_output['permissionDecisionReason'],
        )

    def test_double_quoted_yaml_regex_decodes_escaped_backslash(self):
        self.write_rule(
            'quoted-regex',
            r'''
            ---
            name: quoted-regex-rule
            enabled: true
            event: bash
            pattern: "rm\\s+-rf"
            action: block
            ---

            Quoted regex matched.
            ''',
        )
        payload = self.base_payload('PreToolUse')
        payload.update(
            {
                'tool_name': 'Bash',
                'tool_input': {'command': 'rm -rf build'},
            }
        )

        result = self.run_hook('pretooluse', payload)

        self.assertEqual(
            'deny', result['hookSpecificOutput']['permissionDecision']
        )
        self.assertIn(
            'Quoted regex matched.',
            result['hookSpecificOutput']['permissionDecisionReason'],
        )

    def test_yaml_inline_comment_is_not_part_of_regex(self):
        self.write_rule(
            'inline-comment',
            r'''
            ---
            name: inline-comment-rule
            enabled: true
            event: bash
            pattern: rm\s+-rf # destructive command
            action: block
            ---

            Inline-comment regex matched.
            ''',
        )
        payload = self.base_payload('PreToolUse')
        payload.update(
            {
                'tool_name': 'Bash',
                'tool_input': {'command': 'rm -rf build'},
            }
        )

        result = self.run_hook('pretooluse', payload)

        self.assertEqual(
            'deny', result['hookSpecificOutput']['permissionDecision']
        )
        self.assertIn(
            'Inline-comment regex matched.',
            result['hookSpecificOutput']['permissionDecisionReason'],
        )

    def test_userpromptsubmit_uses_prompt_and_top_level_block_contract(self):
        self.write_rule(
            'production-prompt',
            r'''
            ---
            name: block-production-prompt
            enabled: true
            event: prompt
            pattern: deploy to production
            action: block
            ---

            Production deployment needs approval.
            ''',
        )
        payload = self.base_payload('UserPromptSubmit')
        payload['prompt'] = 'Please deploy to production now.'

        result = self.run_hook('userpromptsubmit', payload)

        self.assertEqual('block', result['decision'])
        self.assertIn('Production deployment needs approval.', result['reason'])

    def test_posttooluse_uses_top_level_block_contract(self):
        self.write_rule(
            'post-command',
            r'''
            ---
            name: block-after-command
            enabled: true
            event: bash
            pattern: echo done
            action: block
            ---

            Follow-up work is required.
            ''',
        )
        payload = self.base_payload('PostToolUse')
        payload.update(
            {
                'tool_name': 'Bash',
                'tool_input': {'command': 'echo done'},
                'tool_response': {'stdout': 'done\n', 'stderr': ''},
            }
        )

        result = self.run_hook('posttooluse', payload)

        self.assertEqual('block', result['decision'])
        self.assertIn('Follow-up work is required.', result['reason'])
        self.assertNotIn('hookSpecificOutput', result)

    def test_stop_simple_rule_blocks_once_and_honors_reentry_guard(self):
        self.write_rule(
            'completion-check',
            r'''
            ---
            name: completion-check
            enabled: true
            event: stop
            pattern: .*
            action: block
            ---

            Complete the checklist first.
            ''',
        )
        self.transcript.write_text(
            '{"type":"assistant","message":"ready to stop"}\n',
            encoding='utf-8',
        )
        payload = self.base_payload('Stop')
        payload['stop_hook_active'] = False

        first_result = self.run_hook('stop', payload)
        self.assertEqual('block', first_result['decision'])
        self.assertIn('Complete the checklist first.', first_result['reason'])

        payload['stop_hook_active'] = True
        self.assertEqual({}, self.run_hook('stop', payload))

    def test_require_tests_rule_accepts_each_supported_test_command(self):
        example = (
            PLUGIN_SOURCE / 'examples' / 'require-tests-stop.local.md'
        ).read_text(encoding='utf-8')
        self.write_rule(
            'require-tests', example.replace('enabled: false', 'enabled: true', 1)
        )
        payload = self.base_payload('Stop')
        payload['stop_hook_active'] = False

        for command in [
            'npm test',
            'pytest',
            'cargo test',
            'cd app\nnpm test',
            'pwd\npytest --version',
            'echo prep # explain the next step\nnpm test',
            "npm " + "\\" + "\n" + "test",
        ]:
            with self.subTest(command=command):
                self.transcript.write_text(
                    json.dumps(
                        {
                            'type': 'assistant',
                            'message': {
                                'role': 'assistant',
                                'content': [
                                    {
                                        'type': 'tool_use',
                                        'name': 'Bash',
                                        'input': {'command': command},
                                    }
                                ],
                            },
                        }
                    ) + '\n',
                    encoding='utf-8',
                )
                self.assertEqual({}, self.run_hook('stop', payload))

        self.transcript.write_text(
            json.dumps(
                {
                    'type': 'assistant',
                    'message': {
                        'role': 'assistant',
                        'content': [
                            {
                                'type': 'tool_use',
                                'name': 'Bash',
                                'input': {'command': 'git status'},
                            }
                        ],
                    },
                }
            ) + '\n',
            encoding='utf-8',
        )
        missing_test_result = self.run_hook('stop', payload)
        self.assertEqual('block', missing_test_result['decision'])
        self.assertIn('No test command', missing_test_result['reason'])

    def test_require_tests_rule_ignores_test_names_in_conversation_text(self):
        example = (
            PLUGIN_SOURCE / 'examples' / 'require-tests-stop.local.md'
        ).read_text(encoding='utf-8')
        self.write_rule(
            'require-tests', example.replace('enabled: false', 'enabled: true', 1)
        )
        payload = self.base_payload('Stop')
        payload['stop_hook_active'] = False
        records = [
            {
                'type': 'user',
                'message': {
                    'role': 'user',
                    'content': 'Please run npm test before finishing.',
                },
            },
            {
                'type': 'assistant',
                'message': {
                    'role': 'assistant',
                    'content': [
                        {
                            'type': 'text',
                            'text': 'I should run pytest or cargo test.',
                        }
                    ],
                },
            },
        ]
        self.transcript.write_text(
            ''.join(json.dumps(record) + '\n' for record in records),
            encoding='utf-8',
        )

        result = self.run_hook('stop', payload)

        self.assertEqual('block', result['decision'])
        self.assertIn('No test command', result['reason'])

    def test_require_tests_rule_ignores_test_names_passed_as_command_data(self):
        example = (
            PLUGIN_SOURCE / 'examples' / 'require-tests-stop.local.md'
        ).read_text(encoding='utf-8')
        self.write_rule(
            'require-tests', example.replace('enabled: false', 'enabled: true', 1)
        )
        payload = self.base_payload('Stop')
        payload['stop_hook_active'] = False

        for command in [
            'echo "npm test"',
            "printf '%s\\n' pytest",
            'echo cargo test',
            'true || npm test',
            'false && pytest',
            'false && (npm test)',
            'true || (npm test)',
        ]:
            with self.subTest(command=command):
                self.transcript.write_text(
                    json.dumps(
                        {
                            'type': 'assistant',
                            'message': {
                                'role': 'assistant',
                                'content': [
                                    {
                                        'type': 'tool_use',
                                        'name': 'Bash',
                                        'input': {'command': command},
                                    }
                                ],
                            },
                        }
                    ) + '\n',
                    encoding='utf-8',
                )

                result = self.run_hook('stop', payload)

                self.assertEqual('block', result['decision'])
                self.assertIn('No test command', result['reason'])


if __name__ == '__main__':
    unittest.main()
