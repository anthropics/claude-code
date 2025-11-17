"""
AppDater - Restore Script Generator
Generates atomic restore scripts from logged operations.
"""

import os
from pathlib import Path
from typing import List, Dict
from datetime import datetime


class RestoreScriptGenerator:
    """Generates restore scripts to undo operations"""

    def __init__(self, output_dir: Path):
        """
        Initialize restore script generator

        Args:
            output_dir: Directory to save restore scripts
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_restore_script(
        self,
        operations: List[Dict],
        script_name: str = None
    ) -> Path:
        """
        Generate ATOMIC restore script from operations log

        CRITICAL: Operations are reversed to undo in correct order!

        Args:
            operations: List of operation dictionaries from logger
            script_name: Optional custom script name

        Returns:
            Path to generated restore script

        Examples:
            >>> generator = RestoreScriptGenerator(Path('./restore'))
            >>> ops = [
            ...     {'type': 'rename', 'old_name': 'A.dmg', 'new_name': 'B.dmg', 'path': '/files'},
            ...     {'type': 'delete', 'filename': 'C.dmg', 'full_path': '/files/C.dmg'}
            ... ]
            >>> script_path = generator.generate_restore_script(ops)
        """
        # Generate script name with timestamp
        if script_name is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            script_name = f"Restore_{timestamp}.sh"

        script_path = self.output_dir / script_name

        # Build script content
        script_lines = self._build_script_header()

        # CRITICAL: Reverse operations to undo in correct order
        # (last operation should be undone first)
        for op in reversed(operations):
            if op['type'] == 'rename':
                script_lines.extend(self._undo_rename(op))
            elif op['type'] == 'delete':
                script_lines.extend(self._undo_delete(op))

        script_lines.extend(self._build_script_footer())

        # Write script
        with open(script_path, 'w') as f:
            f.write('\n'.join(script_lines))

        # Make executable
        os.chmod(script_path, 0o755)

        return script_path

    def _build_script_header(self) -> List[str]:
        """Build script header with safety settings"""
        return [
            "#!/bin/bash",
            "#",
            "# AppDater Restore Script",
            f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "#",
            "# This script will restore files to their original state",
            "# BEFORE running AppDater operations.",
            "#",
            "",
            "# Exit on any error (atomic operation)",
            "set -e",
            "",
            "# Print commands as they execute (for debugging)",
            "# Uncomment the following line if you want verbose output:",
            "# set -x",
            "",
            "echo '=========================================='",
            "echo 'AppDater Restore Script'",
            "echo '=========================================='",
            "echo ''",
            "echo 'This will restore files to their pre-AppDater state.'",
            "echo 'Operations will be performed in reverse order.'",
            "echo ''",
            "read -p 'Continue? [y/N] ' -n 1 -r",
            "echo",
            "if [[ ! $REPLY =~ ^[Yy]$ ]]; then",
            "    echo 'Restore cancelled.'",
            "    exit 1",
            "fi",
            "",
            "echo ''",
            "echo 'Starting restore...'",
            "echo ''",
            ""
        ]

    def _build_script_footer(self) -> List[str]:
        """Build script footer with success message"""
        return [
            "",
            "echo ''",
            "echo '=========================================='",
            "echo '✓ Restore completed successfully'",
            "echo '=========================================='",
            "echo ''",
            "echo 'All files have been restored to their original state.'",
            ""
        ]

    def _undo_rename(self, operation: Dict) -> List[str]:
        """
        Generate commands to undo a rename operation

        Args:
            operation: Rename operation dictionary

        Returns:
            List of bash commands
        """
        old_path = operation.get('full_old_path')
        new_path = operation.get('full_new_path')

        # If full paths not available, construct them
        if not old_path or not new_path:
            base_path = operation['path']
            old_name = operation['old_name']
            new_name = operation['new_name']
            old_path = f"{base_path}/{old_name}"
            new_path = f"{base_path}/{new_name}"

        return [
            f"# Undo rename: {operation['new_name']} → {operation['old_name']}",
            f"if [ -f '{new_path}' ]; then",
            f"    mv '{new_path}' '{old_path}'",
            f"    echo '  ✓ Restored: {operation['old_name']}'",
            "else",
            f"    echo '  ⚠️  File not found: {new_path}'",
            "fi",
            ""
        ]

    def _undo_delete(self, operation: Dict) -> List[str]:
        """
        Generate commands to warn about deleted files

        Note: Cannot restore deleted files, only warn user

        Args:
            operation: Delete operation dictionary

        Returns:
            List of bash commands
        """
        filename = operation['filename']
        full_path = operation.get('full_path', 'unknown')

        return [
            f"# WARNING: File was deleted and cannot be restored",
            f"echo '  ⚠️  DELETED (cannot restore): {filename}'",
            f"echo '     Original path: {full_path}'",
            ""
        ]

    def generate_backup_script(
        self,
        operations: List[Dict],
        backup_dir: Path,
        script_name: str = None
    ) -> Path:
        """
        Generate script to backup files BEFORE operations

        This is a proactive backup script that should be run BEFORE
        AppDater operations to enable full restoration.

        Args:
            operations: List of planned operations
            backup_dir: Directory to store backups
            script_name: Optional custom script name

        Returns:
            Path to generated backup script
        """
        if script_name is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            script_name = f"Backup_Before_{timestamp}.sh"

        script_path = self.output_dir / script_name

        script_lines = [
            "#!/bin/bash",
            "#",
            "# AppDater Pre-Operation Backup Script",
            f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "#",
            "",
            "set -e",
            "",
            f"BACKUP_DIR='{backup_dir}'",
            "",
            "echo 'Creating backup directory...'",
            "mkdir -p \"$BACKUP_DIR\"",
            "",
            "echo 'Backing up files...'",
            ""
        ]

        # Add backup commands for each file that will be modified
        for op in operations:
            if op['type'] == 'rename':
                old_path = op.get('full_old_path')
                if old_path:
                    script_lines.extend([
                        f"if [ -f '{old_path}' ]; then",
                        f"    cp '{old_path}' \"$BACKUP_DIR/\"",
                        f"    echo '  ✓ Backed up: {op['old_name']}'",
                        "fi",
                        ""
                    ])

        script_lines.extend([
            "echo ''",
            "echo '✓ Backup completed'",
            "echo \"Backup location: $BACKUP_DIR\"",
            ""
        ])

        # Write script
        with open(script_path, 'w') as f:
            f.write('\n'.join(script_lines))

        # Make executable
        os.chmod(script_path, 0o755)

        return script_path
