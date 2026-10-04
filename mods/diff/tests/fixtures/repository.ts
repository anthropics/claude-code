/**
 * Git's output in /work, where one file changed, for each invocation whose
 * command line holds the key.
 */
export const REPOSITORY: Readonly<Record<string, string>> = {
  'rev-parse --path-format=absolute': '/work\n/work/.git\n/work/.git\n',
  'HEAD --shortstat': ' 1 file changed, 1 insertion(+)',
  'HEAD --numstat': '1\t0\tapp.ts\0',
  'ls-files': '',
  '-- app.ts': '@@ -1 +1 @@\n-const a = 1\n+const a = 2\n',
}
