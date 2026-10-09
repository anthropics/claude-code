"""Import bootstrap shared by the hookify hook entry points.

The hook scripts need to import the ``hookify`` package (``hookify.core.*``),
but they run as standalone scripts, not as part of an installed package, so
the package has to be made importable first.

The previous approach put ``os.path.dirname(CLAUDE_PLUGIN_ROOT)`` on
``sys.path`` and relied on the plugin directory being named exactly
``hookify``. That assumption does not hold for a marketplace install, where
the plugin lives in a versioned/namespaced directory such as
``~/.claude/plugins/marketplaces/<marketplace>/hookify@0.1.0``. There the
import resolves to nothing and every hook event fails with
``No module named 'hookify'``.

Registering the package explicitly under the name ``hookify`` -- with its
search path pinned to the plugin root -- makes the import independent of both
the directory name and of ``CLAUDE_PLUGIN_ROOT`` being set at all.
"""

import os
import sys
import types

__all__ = ["load_hookify"]


def _plugin_root() -> str:
    """Return the hookify plugin root directory.

    Prefers ``CLAUDE_PLUGIN_ROOT``, but falls back to a path derived from this
    file so the hooks keep working if the variable is missing or points
    somewhere unexpected (e.g. when a script is invoked directly for testing).
    """
    root = os.environ.get("CLAUDE_PLUGIN_ROOT")
    if root:
        root = os.path.abspath(os.path.expanduser(root))
        if os.path.isdir(os.path.join(root, "core")):
            return root

    # hooks/_bootstrap.py -> hooks/ -> <plugin root>
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_hookify():
    """Make the ``hookify`` package importable and return it.

    Idempotent: a second call reuses the module already in ``sys.modules``.
    """
    existing = sys.modules.get("hookify")
    if existing is not None:
        return existing

    root = _plugin_root()

    package = types.ModuleType("hookify")
    package.__path__ = [root]
    package.__package__ = "hookify"
    package.__doc__ = "hookify plugin package (registered by hooks/_bootstrap.py)"
    sys.modules["hookify"] = package
    return package
