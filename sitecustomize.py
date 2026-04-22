"""Repository-local interpreter compatibility hooks.

Python 3.9's ``dataclasses.dataclass`` does not accept ``slots=...``.
This shim makes repository code that uses ``@dataclass(slots=True)``
import cleanly on 3.9 by ignoring the ``slots`` keyword on older runtimes.
"""

from __future__ import annotations

import dataclasses as _dataclasses
import sys as _sys


if _sys.version_info < (3, 10):
    _original_dataclass = _dataclasses.dataclass

    def _compat_dataclass(*args, **kwargs):
        kwargs.pop("slots", None)
        return _original_dataclass(*args, **kwargs)

    _dataclasses.dataclass = _compat_dataclass
