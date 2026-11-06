# privacy

The context hands the model the signed-in account's address to identify the
user. This mod keeps that address from going out as a client's contact details.
It holds one `tool.check` hook: a Bash, PowerShell or Monitor call whose
input holds that address and names a User-Agent is refused. The address counts
in any case or percent-encoded.

A User-Agent is named by `USER_AGENT_WORD` (`User-Agent`, `user_agent`,
`--user-agent`, `-UserAgent`, a prefix of those flags, `UA=`) or by `CLIENT_FLAGS`
(`curl -A`, `wget -U`, and `-User` for PowerShell's web commands and Windows
PowerShell's `curl` and `wget` aliases of them). These flags also count with
PowerShell's other dashes, the en dash, em dash and horizontal bar.

The refusal raises no prompt, whoever is there and whatever the permission mode.
`REFUSAL` tells the model to run the call again without the address, or, if
someone asked to send it, without that setting or as separate calls. A saved allow rule and
auto mode's classifier do not clear it. A deny beneath keeps its own reason.

The test is two word matches over the whole input. There is no parser, on
purpose: it keeps the test simple. So a call that sets a User-Agent and sends
the address elsewhere is refused, and so is one that only mentions the word
beside the address, or real curl's `-user`, which is `-u ser`. Those false
refusals are accepted for simplicity.

This is a courtesy, not a boundary, and it covers one shape. These pass, and
leave the machine if the line sends them:

- The address with no User-Agent named: a URL, a request body, `curl -u`, a
  `From:` header.
- A web tool call. WebFetch and WebSearch are not checked, and neither are MCP
  tools.
- A value computed at run time (`$(git config user.email)`), a variable, a file
  sent by name, a script that holds the address, a
  client not named here, a client that sets the header in another way, such as a
  PowerShell hashtable splatted with a `User` key, any encoding other than one pass
  of percent-encoding, and a non-ASCII address percent-encoded.

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
