"""Shared bootstrap for hookify's hook entry points.

Registers this plugin's own directory as the "hookify" package regardless of
its on-disk directory name. Claude Code may install or cache a plugin under
a version-numbered directory (e.g. ".../hookify/0.1.0/") rather than one
literally named "hookify". A plain sys.path-based ``import hookify.xxx``
only works if some directory *named* "hookify" is on sys.path - it silently
breaks the moment the install layout changes, with every hook failing with
``No module named 'hookify'``. Building the module directly from
CLAUDE_PLUGIN_ROOT removes that assumption entirely.
"""
import importlib.util
import os
import sys


def ensure_hookify_importable() -> None:
    """Make ``import hookify.xxx`` work no matter what CLAUDE_PLUGIN_ROOT is named."""
    if "hookify" in sys.modules:
        return
    plugin_root = os.environ.get("CLAUDE_PLUGIN_ROOT")
    if not plugin_root:
        return
    init_path = os.path.join(plugin_root, "__init__.py")
    spec = importlib.util.spec_from_file_location(
        "hookify", init_path, submodule_search_locations=[plugin_root]
    )
    if spec is None or spec.loader is None:
        return
    module = importlib.util.module_from_spec(spec)
    sys.modules["hookify"] = module
    spec.loader.exec_module(module)
