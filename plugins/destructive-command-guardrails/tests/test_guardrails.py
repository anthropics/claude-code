import subprocess, sys, os, json

SCRIPT = os.path.join(os.getcwd(), 'plugins/destructive-command-guardrails/hooks/guardrails.py')
passed = 0
failed = 0

def run(name, command, should_block, expect_rule=None):
    global passed, failed
    payload = json.dumps({
        'tool_name': 'Bash',
        'tool_input': {'command': command or ''},
        'session_id': 'test',
        'cwd': '/tmp'
    })
    r = subprocess.run(
        [sys.executable, SCRIPT],
        input=payload, capture_output=True, text=True, timeout=5
    )
    blocked = r.returncode == 2
    ok = True
    if blocked != should_block:
        action = 'BLOCKED' if blocked else 'ALLOWED'
        expect = 'block' if should_block else 'allow'
        print(f'  FAIL [{name}]: expected {expect}, got {action}')
        if r.stderr:
            print(f'    stderr: {r.stderr[:150]}')
        ok = False
    if expect_rule and blocked and expect_rule not in r.stderr:
        print(f'  FAIL [{name}]: expected rule "{expect_rule}" in output')
        ok = False
    if ok:
        print(f'  PASS [{name}]')
        passed += 1
    else:
        failed += 1

print('=== Destructive Command Guardrails Test Suite ===\n')

print('--- Filesystem ---')
run('rm -rf /',           'rm -rf /',                       True, 'rm_recursive_force')
run('rm -rf .',           'rm -rf .',                       True, 'rm_recursive_force')
run('rm -fr /var',        'rm -fr /var',                    True, 'rm_recursive_force')
run('rm --no-preserve',   'rm --no-preserve-root /',        True, 'rm_recursive_force')
run('rm -r ~/',           'rm -r ~/',                       True, 'rm_recursive_broad')
run('rm -r ..',           'rm -r ../',                      True, 'rm_recursive_broad')
run('find / -delete',     'find / -delete',                 True, 'find_delete')
run('find -exec rm',      'find . -name "*.log" -exec rm {} +', True, 'find_delete')
run('PS Remove-Item',     'Remove-Item C:\\ -Recurse -Force',   True, 'powershell_remove_recursive')

print('\n--- Git ---')
run('git reset --hard',      'git reset --hard',                    True, 'git_reset_hard')
run('git reset --hard HEAD', 'git reset --hard HEAD~3',             True, 'git_reset_hard')
run('git clean -fd',         'git clean -fd',                       True, 'git_clean_fd')
run('git clean -df',         'git clean -df',                       True, 'git_clean_fd')
run('git push --force',      'git push --force origin main',        True, 'git_force_push')
run('git push -f',           'git push -f origin main',             True, 'git_force_push')
run('git checkout -- .',     'git checkout -- .',                   True, 'git_checkout_dot')
run('git stash clear',       'git stash clear',                     True, 'git_stash_clear')
run('git branch -D',         'git branch -D my-feature',            True, 'git_branch_force_delete')

print('\n--- SQL ---')
run('DROP TABLE',         'psql -c "DROP TABLE users;"',          True, 'sql_drop')
run('DROP DATABASE',      'mysql -e "DROP DATABASE mydb"',        True, 'sql_drop')
run('TRUNCATE',           'psql -c "TRUNCATE TABLE orders;"',     True, 'sql_truncate')
run('DELETE no WHERE',    'psql -c "DELETE FROM users;"',         True, 'sql_delete_all')
run('DELETE WHERE 1=1',   'psql -c "DELETE FROM users WHERE 1=1"', True, 'sql_delete_all')

print('\n--- Docker ---')
run('docker prune -a',      'docker system prune -a',              True, 'docker_prune_all')
run('docker prune --all',   'docker system prune --all',           True, 'docker_prune_all')
run('docker vol prune',     'docker volume prune',                 True, 'docker_volume_prune')

print('\n--- System ---')
run('mkfs.ext4',          'mkfs.ext4 /dev/sda1',                  True, 'mkfs_format')
run('dd of=/dev/',        'dd if=/dev/zero of=/dev/sda bs=4M',    True, 'dd_device_write')
run('sudo rm',            'sudo rm /etc/passwd',                   True, 'sudo_destructive')
run('sudo dd',            'sudo dd if=/dev/zero of=backup.img',   True, 'sudo_destructive')
run('kill -9 pattern',    'killall -9 node',                       True, 'kill_force')
run('pkill -9',           'pkill -9 python',                       True, 'kill_force')

print('\n--- Config overwrite ---')
run('overwrite .env',        '> .env',                              True, 'overwrite_dotfile')
run('overwrite .bashrc',     '> ~/.bashrc',                         True, 'overwrite_dotfile')
run('overwrite .gitconfig',  '> ~/.gitconfig',                      True, 'overwrite_dotfile')

print('\n--- Misc ---')
run('pip uninstall -y',      'pip uninstall -y numpy pandas',       True, 'pip_uninstall_yes')
run('npm cache nuke',        'npm cache clean --force',             True, 'npm_cache_nuke')

print('\n--- Chained commands ---')
run('chain with rm -rf',     'cd /tmp && rm -rf / && echo done',    True, 'rm_recursive_force')
run('semicolon chain',       'echo hi; git reset --hard',           True, 'git_reset_hard')
run('pipe chain',            'echo y | rm -rf /',                   True, 'rm_recursive_force')

print('\n--- Should ALLOW (safe) ---')
run('ls',                    'ls -la',                              False)
run('git status',            'git status',                          False)
run('git commit',            'git commit -m "fix bug"',             False)
run('git push (normal)',     'git push origin main',                False)
run('git branch -d',         'git branch -d my-feature',            False)
run('rm single file',        'rm file.txt',                         False)
run('rm -f single',          'rm -f temp.log',                      False)
run('echo to file',          'echo hello > output.txt',             False)
run('cat file',              'cat .env',                             False)
run('pip install',           'pip install numpy',                    False)
run('npm install',           'npm install express',                  False)
run('docker build',          'docker build -t myapp .',             False)
run('docker run',            'docker run -it ubuntu bash',          False)
run('SELECT query',          'psql -c "SELECT * FROM users;"',      False)
run('DELETE with WHERE',     'psql -c "DELETE FROM users WHERE id=5;"', False)
run('python script',         'python3 manage.py migrate',           False)
run('curl',                  'curl -s https://api.example.com',     False)

print('\n--- Should ALLOW (allowlisted) ---')
run('rm -rf node_modules',  'rm -rf node_modules',                 False)
run('rm -rf dist',          'rm -rf dist',                          False)
run('rm -rf build',         'rm -rf build',                         False)
run('rm -rf .cache',        'rm -rf .cache',                        False)
run('rm -rf __pycache__',   'rm -rf __pycache__',                   False)
run('rm -rf .next',         'rm -rf .next',                         False)
run('rm -rf coverage',      'rm -rf coverage',                      False)
run('rm -rf .pytest_cache', 'rm -rf .pytest_cache',                 False)
run('rm -rf /tmp/...',      'rm -rf /tmp/test-build',               False)
run('git clean -n',          'git clean -nfd',                      False)
run('docker prune filter',  'docker system prune -a --filter until=24h', False)
run('kill -9 specific PID', 'kill -9 12345',                        False)

print('\n--- Edge cases ---')
run('empty command',         '',                                    False)

print(f'\n=== Results: {passed} passed, {failed} failed ===')
sys.exit(1 if failed else 0)
