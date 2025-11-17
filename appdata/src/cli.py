"""
AppDater - CLI Entry Point
Command-line interface for AppDater operations.
"""

import sys
from pathlib import Path
from typing import Optional
import argparse

from .core.validator import FilenameValidator
from .core.renamer import SmartRenamer
from .core.duplicates import UltraSmartDuplicateDetector
from .safety.guardian import SafetyGuardian
from .io.logger import SafeLogger
from .io.restore import RestoreScriptGenerator
from .io.config_loader import ConfigLoader
from .ui.terminal import TerminalUI


class AppDater:
    """Main AppDater application"""

    def __init__(self, config_path: Optional[Path] = None):
        """
        Initialize AppDater

        Args:
            config_path: Optional path to config file
        """
        # Load configuration
        self.config = ConfigLoader(config_path)

        # Initialize components
        self.validator = FilenameValidator()
        self.renamer = SmartRenamer(self.validator)
        self.duplicate_detector = UltraSmartDuplicateDetector()
        self.guardian = SafetyGuardian(
            min_disk_free_gb=self.config.get('safety.min_disk_free_gb', 10)
        )
        self.ui = TerminalUI()

        # Logger (initialized later per operation)
        self.logger = None

    def rename_files(self, directory: Path, dry_run: bool = False):
        """
        Rename files in directory

        Args:
            directory: Directory containing files
            dry_run: If True, only preview changes
        """
        directory = Path(directory)

        if not directory.exists():
            self.ui.print(f"❌ Directory not found: {directory}", "red")
            return False

        # Pre-flight safety check
        if not dry_run and not self.guardian.pre_flight_check(str(directory)):
            return False

        # Initialize logger
        log_dir = Path(self.config.get('logging.log_dir', './logs'))
        self.logger = SafeLogger(log_dir, "AppDater_Rename")

        # Find files
        extensions = self.config.get('processing.supported_extensions', ['.dmg', '.pkg', '.iso'])
        recursive = self.config.get('processing.recursive', True)

        files = []
        if recursive:
            for ext in extensions:
                files.extend(directory.rglob(f'*{ext}'))
        else:
            for ext in extensions:
                files.extend(directory.glob(f'*{ext}'))

        # Filter out hidden files if configured
        if self.config.get('processing.skip_hidden_files', True):
            files = [f for f in files if not f.name.startswith('.')]

        if not files:
            self.ui.print("No files found to process.", "yellow")
            return True

        self.ui.print(f"Found {len(files)} file(s) to process", "cyan")

        # Preview or execute
        operations = []
        skipped = 0
        renamed = 0

        with self.ui.create_progress() as progress:
            task = progress.add_task("Processing files...", total=len(files))

            for file_path in files:
                # Check if safe to process
                is_safe, reason = self.validator.is_safe_to_process(file_path.name)

                if not is_safe:
                    self.logger.log_skip(file_path.name, reason) if self.logger else None
                    skipped += 1
                    progress.update(task, advance=1)
                    continue

                # Generate new name
                new_name = self.renamer.generate_new_name(file_path.name, file_path)

                if new_name is None:
                    self.logger.log_skip(file_path.name, "Validation failed or already processed") if self.logger else None
                    skipped += 1
                    progress.update(task, advance=1)
                    continue

                # Check if name actually changed
                if new_name == file_path.name:
                    self.logger.log_skip(file_path.name, "No changes needed") if self.logger else None
                    skipped += 1
                    progress.update(task, advance=1)
                    continue

                # Add to operations
                operations.append({
                    'type': 'rename',
                    'old_name': file_path.name,
                    'new_name': new_name,
                    'path': str(file_path.parent),
                    'full_old_path': str(file_path),
                    'full_new_path': str(file_path.parent / new_name)
                })

                if dry_run:
                    print(f"  [DRY-RUN] {file_path.name} → {new_name}")
                else:
                    # Execute rename
                    try:
                        new_path = file_path.parent / new_name
                        file_path.rename(new_path)
                        self.logger.log_rename(file_path.name, new_name, file_path)
                        renamed += 1
                    except Exception as e:
                        self.logger.log_error(f"Failed to rename {file_path.name}", e)

                progress.update(task, advance=1)

        # Print summary
        if dry_run:
            self.ui.print(f"\n[DRY-RUN] Would rename {len(operations)} file(s), skip {skipped}", "yellow")
        else:
            self.ui.print(f"\n✓ Renamed {renamed} file(s), skipped {skipped}", "green")

            # Generate restore script
            if operations:
                restore_dir = Path(self.config.get('logging.restore_dir', './restore'))
                restore_gen = RestoreScriptGenerator(restore_dir)
                restore_script = restore_gen.generate_restore_script(operations)
                self.ui.print(f"✓ Restore script: {restore_script}", "cyan")

            # Finalize logger
            if self.logger:
                self.logger.finalize()

        return True

    def find_duplicates(self, directory: Path, auto_delete: bool = False, dry_run: bool = False):
        """
        Find and optionally delete duplicate files

        Args:
            directory: Directory to search
            auto_delete: If True, automatically delete old versions
            dry_run: If True, only preview changes
        """
        directory = Path(directory)

        if not directory.exists():
            self.ui.print(f"❌ Directory not found: {directory}", "red")
            return False

        self.ui.print_header("Duplicate Detection")

        # Find duplicates
        with self.ui.create_progress() as progress:
            task = progress.add_task("Scanning for duplicates...", total=1)
            duplicates = self.duplicate_detector.find_duplicates(directory)
            progress.update(task, advance=1)

        if not duplicates:
            self.ui.print("✓ No duplicates found!", "green")
            return True

        # Generate report
        report = self.duplicate_detector.generate_report(duplicates)
        self.ui.print_duplicate_report(report)

        # Get files to delete
        files_to_delete = self.duplicate_detector.get_files_to_delete(duplicates)

        if dry_run:
            self.ui.print(f"\n[DRY-RUN] Would delete {len(files_to_delete)} file(s)", "yellow")
            for file_path, product_name, file_size in files_to_delete:
                size_mb = file_size / (1024 * 1024)
                print(f"  - {file_path.name} ({size_mb:.1f} MB)")
            return True

        # Ask for confirmation unless auto_delete
        if not auto_delete:
            if not self.ui.confirm(f"Delete {len(files_to_delete)} old version(s)?", default=False):
                self.ui.print("Operation cancelled.", "yellow")
                return True

        # Pre-flight check (deletion is safe, but we check anyway)
        if not self.guardian.pre_flight_check(str(directory)):
            return False

        # Initialize logger
        log_dir = Path(self.config.get('logging.log_dir', './logs'))
        self.logger = SafeLogger(log_dir, "AppDater_Duplicates")

        # Delete files
        deleted = 0
        space_freed = 0

        with self.ui.create_progress() as progress:
            task = progress.add_task("Deleting old versions...", total=len(files_to_delete))

            for file_path, product_name, file_size in files_to_delete:
                try:
                    file_path.unlink()
                    self.logger.log_delete(file_path.name, file_path, f"Old version of {product_name}")
                    deleted += 1
                    space_freed += file_size
                except Exception as e:
                    self.logger.log_error(f"Failed to delete {file_path.name}", e)

                progress.update(task, advance=1)

        # Print summary
        space_freed_gb = space_freed / (1024 ** 3)
        self.ui.print(f"\n✓ Deleted {deleted} file(s)", "green")
        self.ui.print(f"✓ Freed {space_freed_gb:.2f} GB of disk space", "green")

        # Finalize logger
        if self.logger:
            self.logger.finalize()

        return True

    def generate_report(self, directory: Path, output_format: str = 'text'):
        """
        Generate report of files

        Args:
            directory: Directory to analyze
            output_format: Report format ('text', 'json', 'html')
        """
        directory = Path(directory)

        if not directory.exists():
            self.ui.print(f"❌ Directory not found: {directory}", "red")
            return False

        # Find duplicates
        duplicates = self.duplicate_detector.find_duplicates(directory)
        report = self.duplicate_detector.generate_report(duplicates)

        if output_format == 'json':
            import json
            output_file = directory / 'appdater_report.json'
            with open(output_file, 'w') as f:
                json.dump(report, f, indent=2)
            self.ui.print(f"✓ Report saved to: {output_file}", "green")

        elif output_format == 'html':
            self.ui.print("HTML format not yet implemented", "yellow")

        else:  # text
            self.ui.print_duplicate_report(report)

        return True


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description='AppDater - Automated macOS software image management',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry-run rename
  appdater rename --dry-run /path/to/files

  # Execute rename
  appdater rename /path/to/files

  # Find duplicates
  appdater duplicates /path/to/files --dry-run

  # Delete duplicates
  appdater duplicates /path/to/files --execute

  # Generate report
  appdater report /path/to/files --format json
        """
    )

    parser.add_argument(
        '--config',
        type=Path,
        help='Path to configuration file'
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to execute')

    # Rename command
    rename_parser = subparsers.add_parser('rename', help='Rename files to standard format')
    rename_parser.add_argument('directory', type=Path, help='Directory containing files')
    rename_parser.add_argument('--dry-run', action='store_true', help='Preview changes only')

    # Duplicates command
    dup_parser = subparsers.add_parser('duplicates', help='Find and remove duplicate versions')
    dup_parser.add_argument('directory', type=Path, help='Directory to search')
    dup_parser.add_argument('--dry-run', action='store_true', help='Preview changes only')
    dup_parser.add_argument('--execute', action='store_true', help='Execute deletion')

    # Report command
    report_parser = subparsers.add_parser('report', help='Generate report')
    report_parser.add_argument('directory', type=Path, help='Directory to analyze')
    report_parser.add_argument('--format', choices=['text', 'json', 'html'], default='text', help='Report format')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    # Initialize AppDater
    app = AppDater(config_path=args.config)

    # Execute command
    try:
        if args.command == 'rename':
            success = app.rename_files(args.directory, dry_run=args.dry_run)

        elif args.command == 'duplicates':
            success = app.find_duplicates(
                args.directory,
                auto_delete=args.execute,
                dry_run=args.dry_run
            )

        elif args.command == 'report':
            success = app.generate_report(args.directory, output_format=args.format)

        else:
            parser.print_help()
            return 1

        return 0 if success else 1

    except KeyboardInterrupt:
        print("\n\n⚠️  Operation cancelled by user")
        return 130

    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
