#!/usr/bin/env bash
# preserve-session: inherit (deprecated — v1.2.0)
#
# The original `inherit` command has been split into two dedicated commands:
#   /preserve-session:copy   (non-destructive, creates independent copies)
#   /preserve-session:move   (destructive, migrates sessions to target)
#
# This file remains only as a deprecation stub that redirects users. Planned
# for removal in a future major version.

set -euo pipefail

cat >&2 <<'DEPRECATED_EOF'
⚠️  /preserve-session:inherit is deprecated (v1.2.0+).

The inherit command was split into two dedicated commands:

  /preserve-session:copy <path>   — non-destructive copy (creates independent
                                    session copies in the current project; the
                                    source project is not modified)

  /preserve-session:move <path>   — destructive migration (moves session files
                                    out of the source; the source project is
                                    emptied of its session history)

Please use one of the above instead. The inherit command will be removed in a
future major release.
DEPRECATED_EOF
exit 1
