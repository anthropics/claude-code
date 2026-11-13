# privacy

The context hands the model the signed-in account's address to identify the
user. This mod keeps that address from going out as a client's identity. It
holds one `tool.check` hook, which reads each tool as below. The address counts
in any case or percent-encoded.

- **Bash, PowerShell, Monitor:** the whole input, and the text of each script its
  `command` names outside a git or gh command, are refused if they hold the address
  and a word that declares who is calling. A line that only touches files reads none.
- **Write, Edit, NotebookEdit:** what is being written, by the same test. Not the
  path. An Edit is refused only when `new_string` meets the test and `old_string`
  doesn't, since carrying over a line the file already holds adds nothing.
- **WebFetch:** the address in `url` is refused with no second word, since the URL
  is what goes out.
- **`mcp__*`:** the whole input, keys included, by the same test.

A word that declares who is calling is one of:

- A User-Agent: `USER_AGENT_WORD` (`User-Agent`, `user_agent`, `--user-agent`,
  `-UserAgent`, a prefix of those flags, `UA=`) or `CLIENT_FLAGS` (`curl -A`,
  `wget -U`, and `-User` for PowerShell's web commands and Windows PowerShell's
  `curl` and `wget` aliases of them, with PowerShell's other dashes too, the en
  dash, em dash and horizontal bar).
- `IDENTITY_WORD`: `set_identity`, `identity=` (so `EDGAR_IDENTITY=`), `--identity`,
  `mailto=`, and site words that catch an address given by position, as in
  `Downloader("Acme", address)`: `sec_edgar`, `edgartools`, `browse-edgar`, `from
  edgar import`, `import edgar` and `sec.gov`. A bare `edgar` does not count, since
  a person's name or home folder can be one.
- A `From` header: `FROM_FLAG` (`-H "From: ..."`), or `FROM_KEY` (a quoted `"From"`
  key) after the word `headers`, so a mail API's body passes.

`COMPUTED_ADDRESS` counts as the address beside any of these words on its own line:
`git config user.email` in its usual spellings, unless it is given a value to set,
and `$GIT_AUTHOR_EMAIL` and `$GIT_COMMITTER_EMAIL`. The address itself counts with
a word anywhere in the text.

Scripts are found by a word match, not a parser: relative names with a script's
extension, and `./name` with no extension, up to `MOST_SCRIPTS` per line, one level
only. This closes a script made any way and then run. Only the line a shell tool
runs is searched, not a field such as `description`. A git command is taken out of
it first: from a first word `git`, after any `VAR=value` assignments, to the next
`&`, `|`, `;` or newline, with whole quotes and a heredoc to its closing word. So
neither `git add fetch.py` nor a multi-line commit message that names it is refused
for what the script holds. A heredoc that isn't git's, such as `bash <<EOF`, stays
searched. Any other spelling of git is read like any other line: `"git"`, `(git`,
`env X=1 git`, `git.exe`, `NAME="Jo Smith" git add`, and Tmux's `send-keys git add
fetch.py`, which types keys rather than running a line. A gh command is taken out
the same way, so a pull request body may name a script. The hook runs before any
approval, so it follows no link that its walk sees: it walks each name's components
from the working directory with `$.fs.list`, and reads a plain file only if none is
a link. A link swapped in between by a process already writing the folder isn't
covered. A file that cannot be read (missing, over 4 MiB, a network path) holds nothing, and
the call goes on.

A line only touches files where every command starts with git or another of
`TOUCH_WORDS` (`gh`, `cat`, `sed`, `mv`, `chmod`, linters, formatters, test runners,
`Get-Content`), by git's own pattern, heredocs included, after plain `VAR=value`
assignments and one `python -m`, `uv run`, `npx` or `bunx`. A bare word only, so not
`./cat`. A line isn't exempt if it holds a backtick, `$(` other than `$(cat <<`, `<(`,
`>(`, `@(`, `<<<`, a separator on a heredoc's opening line, a quote or `<<` in a
comment, or in PowerShell a backslash right before `;`, `|`, `&`, `"` or a newline.
Any other line is read as above, so `mv fetch.py g.py && python3 g.py` is refused.

The refusal raises no prompt, whoever is there and whatever the permission mode.
`REFUSAL` tells the model to use a generic client name, and to ask the person if a
site needs a real contact. To send this address, the person sets it themselves in
an environment variable the script reads, or runs the command themselves with
`!`, which calls the shell tool with no permission check. A saved allow rule and
auto mode's classifier do not clear the refusal. A deny beneath keeps its own
reason.

The test is two word matches over the whole text. There is no parser, on purpose:
it keeps the test simple. So a call that sets a User-Agent and sends the address
elsewhere is refused, and so is one that only mentions a word beside the address
(`git log --author=<address> --grep=sec.gov`), one that touches a script holding
both on a line that isn't exempt (`sudo rm fetch.py`, `python3 ok.py && cat
fetch.py`), a script with the address in an `@author` tag,
`curl` on one line and `grep -A` on another, or real curl's `-user` (`-u ser`). Those
false refusals are accepted for simplicity.

## What passes

This is a courtesy against a well-meaning model, not a boundary. These pass, and
leave the machine if the call sends them:

- The address with no word beside it: a URL, a request body or `curl -u` on a
  shell line, an MCP field such as a calendar invite, or a file such as package
  metadata or an `@author` tag.
- A positional address to a library with no identity word and no named site:
  `Client("Acme", address)`, or a site named only by a bare `edgar`.
- A quoted `"From"` key in a text that never says `headers`.
- A value read while a script runs: `settings.json`, or `$(cat contact.txt)`. A
  hook sees only the text it is given.
- A run-time read on one line and the word on another: `EMAIL=$(git config
  user.email)`, then `curl -A "$EMAIL"`.
- An Edit that carries over a line the file already holds with the address and a
  word.
- A script reached by a link, by an absolute path or from outside the working
  directory, which goes unread. Write and Edit still catch the address and an
  identity word at write time.
- A script that a touch command runs: a test runner (`pytest fetch.py`, `bun test`),
  a flag, variable or alias (`rg --pre ./fetch.py`, `GH_PAGER=./fetch.py gh`), zsh's
  `=(...)` or PowerShell's `Get-Content (python fetch.py)`.
- A script named only in a git or gh command, even one it runs: `git bisect run
  ./fetch.py`, `git commit -m "$(python3 fetch.py)"`, or `gh pr create --body
  "$(python3 fetch.py)"`.
- A script that a git or touch command's stray quote or unclosed heredoc runs over,
  since an ambiguous spelling goes unread (`git log --grep=don't`, `$'it\'s'`,
  `<<EOF-1` or a lone carriage return, then `./fetch.py`), or one on the opening line
  of git's or gh's heredoc.
- A file reached through imports or `make`, or a name that is not read against the
  session's directory, such as after a `cd`, or written `~/x.py` or `$DIR/x.py`, or
  one with a space or a non-ASCII letter.
- A client not named here, or one that sets the header in another way, such as a
  PowerShell hashtable splatted with a `User` key.
- Any encoding other than one pass of percent-encoding, and a non-ASCII address
  percent-encoded.
- The address only in a WebFetch `prompt`. WebSearch, the browser tools and the
  local read tools are not checked.

The address is the one the context hands the model, read through
`$.session.identity()`, which answers a built-in with it. A plugin in the `user`
tier is refused that op and is left off its chain.

## What turns it off

- `/plugin disable`, or `"cc-plugin-privacy@builtin": false` under
  `enabledPlugins` in user, `--settings` or managed settings. A repository's
  settings do not.
- A server-side switch, read once per session.
- A hook of an installed plugin, which sits above this one: on `tool.check` it
  may overrule the refusal.
- A session where no hooks module loads, where `hooks/register.ts` does not run.
