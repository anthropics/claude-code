"""
AppDater - Safe Logger
Logs all operations with timestamps for debugging and restoration.
"""

from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
import json


class SafeLogger:
    """Logs operations safely with timestamps"""

    def __init__(self, session_dir: Path, log_name: str = "AppDater"):
        """
        Initialize logger

        Args:
            session_dir: Directory to store logs
            log_name: Name prefix for log files
        """
        self.session_dir = Path(session_dir)
        self.session_dir.mkdir(parents=True, exist_ok=True)

        # Create timestamp for this session
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        self.timestamp = timestamp

        # Log files
        self.log_file = self.session_dir / f"{log_name}_{timestamp}.log"
        self.json_log_file = self.session_dir / f"{log_name}_{timestamp}.json"

        # Operation tracking
        self.operations = []

        # Initialize log file
        self._init_log()

    def _init_log(self):
        """Initialize log file with header"""
        header = [
            "=" * 80,
            f"AppDater Session Log",
            f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "=" * 80,
            ""
        ]

        with open(self.log_file, 'w') as f:
            f.write('\n'.join(header))

    def _timestamp(self) -> str:
        """Get current timestamp string"""
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    def log(self, message: str, level: str = "INFO"):
        """
        Log a message

        Args:
            message: Message to log
            level: Log level (INFO, WARNING, ERROR, SUCCESS)
        """
        line = f"[{self._timestamp()}] [{level:8}] {message}"

        # Write to file
        with open(self.log_file, 'a') as f:
            f.write(line + '\n')

        # Also print to console for INFO and above
        if level in ["INFO", "SUCCESS"]:
            print(message)
        elif level == "WARNING":
            print(f"⚠️  {message}")
        elif level == "ERROR":
            print(f"❌ {message}")

    def log_rename(self, old_name: str, new_name: str, file_path: Path):
        """
        Log a rename operation

        Args:
            old_name: Original filename
            new_name: New filename
            file_path: Path to file
        """
        message = f"RENAME: '{old_name}' → '{new_name}'"
        self.log(message, "INFO")

        # Track operation for restore script
        self.operations.append({
            'type': 'rename',
            'timestamp': self._timestamp(),
            'old_name': old_name,
            'new_name': new_name,
            'path': str(file_path.parent),
            'full_old_path': str(file_path.parent / old_name),
            'full_new_path': str(file_path.parent / new_name)
        })

    def log_delete(self, filename: str, file_path: Path, reason: str):
        """
        Log a delete operation

        Args:
            filename: Name of file being deleted
            file_path: Path to file
            reason: Reason for deletion
        """
        message = f"DELETE: '{filename}' (Reason: {reason})"
        self.log(message, "WARNING")

        # Track operation
        self.operations.append({
            'type': 'delete',
            'timestamp': self._timestamp(),
            'filename': filename,
            'path': str(file_path.parent),
            'full_path': str(file_path),
            'reason': reason
        })

    def log_skip(self, filename: str, reason: str):
        """
        Log a skipped file

        Args:
            filename: Name of file being skipped
            reason: Reason for skipping
        """
        message = f"SKIP: '{filename}' (Reason: {reason})"
        self.log(message, "INFO")

        # Track operation
        self.operations.append({
            'type': 'skip',
            'timestamp': self._timestamp(),
            'filename': filename,
            'reason': reason
        })

    def log_error(self, message: str, error: Exception = None):
        """
        Log an error

        Args:
            message: Error message
            error: Exception object (optional)
        """
        if error:
            full_message = f"{message}: {str(error)}"
        else:
            full_message = message

        self.log(full_message, "ERROR")

        # Track error
        self.operations.append({
            'type': 'error',
            'timestamp': self._timestamp(),
            'message': full_message
        })

    def log_success(self, message: str):
        """
        Log a success message

        Args:
            message: Success message
        """
        self.log(message, "SUCCESS")

    def save_json_log(self):
        """Save operations to JSON file for programmatic access"""
        log_data = {
            'session': {
                'started': self.timestamp,
                'ended': datetime.now().strftime('%Y%m%d_%H%M%S')
            },
            'operations': self.operations,
            'summary': self.get_summary()
        }

        with open(self.json_log_file, 'w') as f:
            json.dump(log_data, f, indent=2)

    def get_summary(self) -> Dict[str, Any]:
        """
        Get summary of operations

        Returns:
            Dictionary with operation counts
        """
        summary = {
            'total_operations': len(self.operations),
            'renames': 0,
            'deletes': 0,
            'skips': 0,
            'errors': 0
        }

        for op in self.operations:
            op_type = op.get('type')
            if op_type == 'rename':
                summary['renames'] += 1
            elif op_type == 'delete':
                summary['deletes'] += 1
            elif op_type == 'skip':
                summary['skips'] += 1
            elif op_type == 'error':
                summary['errors'] += 1

        return summary

    def print_summary(self):
        """Print operation summary to console"""
        summary = self.get_summary()

        print("\n" + "=" * 60)
        print("SESSION SUMMARY")
        print("=" * 60)
        print(f"Total operations: {summary['total_operations']}")
        print(f"  - Renamed:      {summary['renames']}")
        print(f"  - Deleted:      {summary['deletes']}")
        print(f"  - Skipped:      {summary['skips']}")
        print(f"  - Errors:       {summary['errors']}")
        print("=" * 60)
        print(f"\nLog saved to: {self.log_file}")
        print(f"JSON log saved to: {self.json_log_file}")

    def finalize(self):
        """
        Finalize logging session

        Call this at the end of operations
        """
        # Write summary to log
        self.log("=" * 80, "INFO")
        self.log("Session completed", "SUCCESS")
        self.log(f"Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", "INFO")

        summary = self.get_summary()
        for key, value in summary.items():
            self.log(f"{key}: {value}", "INFO")

        self.log("=" * 80, "INFO")

        # Save JSON log
        self.save_json_log()

        # Print summary
        self.print_summary()
