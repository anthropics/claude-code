# AppDater

**Automated macOS Software Image Management System**

AppDater is a Python-based tool that intelligently manages your collection of macOS software images (.dmg, .pkg, .iso files) by:

- Renaming files to a standardized format: `Manufacturer.Product_vVersion.ext`
- Detecting and removing old duplicate versions (keeps newest by modification date)
- Removing architecture-specific files (Intel-only builds)
- Cleaning release group tags ([TNT], [atb], etc.)
- Generating undo/restore scripts for every operation
- **SAFE**: Validates everything before changing, monitors disk space, prevents duplicate runs

## Features

### Core Functionality

- **Smart Renaming**: Automatically renames files to consistent format
- **Duplicate Detection**: Finds multiple versions of same product, keeps newest
- **Safety First**: Pre-flight disk space checks, prevents system crashes
- **Restore Scripts**: Every operation generates an atomic undo script
- **Rich UI**: Beautiful progress bars and terminal output
- **Dry-Run Mode**: Preview all changes before executing

### Safety Features

- Never runs rename twice on same files (prevents duplicate version tags)
- Disk space monitoring (aborts if < 10GB free)
- RAM usage monitoring
- Atomic operations with rollback capability
- Comprehensive logging of all operations

## Installation

### Requirements

- Python 3.8+
- macOS (tested on macOS 10.14+)

### Install Dependencies

```bash
cd appdata
pip install -r requirements.txt
```

### Optional: Install as CLI Tool

```bash
# Add to your PATH or create alias
alias appdater='python /path/to/appdata/src/cli.py'
```

## Usage

### Basic Commands

#### 1. Rename Files (Dry-Run)

Preview what would happen without making changes:

```bash
python src/cli.py rename --dry-run /path/to/files
```

#### 2. Rename Files (Execute)

Execute the rename operation:

```bash
python src/cli.py rename /path/to/files
```

**Output:**
- Renames files to `Manufacturer.Product_vVersion.ext` format
- Generates restore script in `./restore/`
- Creates detailed log in `./logs/`

#### 3. Find Duplicates (Dry-Run)

Preview duplicate detection:

```bash
python src/cli.py duplicates --dry-run /path/to/files
```

#### 4. Delete Duplicates (Execute)

Delete old versions (keeps newest):

```bash
python src/cli.py duplicates --execute /path/to/files
```

#### 5. Generate Report

Generate JSON report of files:

```bash
python src/cli.py report /path/to/files --format json
```

### Examples

#### Example 1: Clean Up Software Library

```bash
# Preview changes
python src/cli.py rename --dry-run ~/Downloads/Apps

# Execute if preview looks good
python src/cli.py rename ~/Downloads/Apps

# Find and remove duplicates
python src/cli.py duplicates --execute ~/Downloads/Apps
```

**Before:**
```
Transmit 5.11.0 [atb].dmg
Adobe Photoshop 27.0.0 MAS.dmg
Stats.dmg
```

**After:**
```
Transmit_v5.11.0.dmg
Adobe.Photoshop_v27.0.0.dmg
Stats_v241117.dmg
```

#### Example 2: Remove Duplicate Versions

```bash
# Find duplicates
python src/cli.py duplicates --dry-run ~/Software

# Delete old versions (keeps newest by modification date)
python src/cli.py duplicates --execute ~/Software
```

**Before:**
```
Adobe.Photoshop_v27.0.0.dmg (modified: 2024-01-15)
Adobe.Photoshop_v28.0.0.dmg (modified: 2024-11-01)
Transmit_v5.10.0.dmg (modified: 2024-05-20)
Transmit_v5.11.0.dmg (modified: 2024-11-10)
```

**After:**
```
Adobe.Photoshop_v28.0.0.dmg (kept - newest)
Transmit_v5.11.0.dmg (kept - newest)
```

*Freed: 4.2 GB of disk space*

## Configuration

AppDater can be configured via YAML file:

```bash
python src/cli.py rename /path/to/files --config custom_config.yaml
```

### Default Configuration

See `config/default.yaml` for all available options:

```yaml
safety:
  min_disk_free_gb: 10      # Abort if disk < 10GB free
  warn_disk_free_gb: 20     # Warn if disk < 20GB free

processing:
  supported_extensions:      # File types to process
    - .dmg
    - .pkg
    - .iso
  recursive: true            # Search subdirectories

duplicates:
  auto_delete: false         # Require confirmation before delete
  keep_newest: true          # Keep newest by modification time
```

## Safety & Restore

### Pre-Flight Checks

Before any operation, AppDater checks:

- **Disk Space**: Aborts if < 10GB free (prevents system crash)
- **RAM Usage**: Warns if > 85% used
- **File Validation**: Ensures files haven't been processed before

### Restore Scripts

Every operation generates an atomic restore script:

```bash
# Restore script saved to:
./restore/Restore_20241117_1430.sh

# To restore:
bash ./restore/Restore_20241117_1430.sh
```

Restore scripts:
- Reverse operations in correct order
- Ask for confirmation before executing
- Include safety checks

### Logs

All operations are logged to `./logs/`:

```
./logs/AppDater_Rename_20241117_143045.log
./logs/AppDater_Rename_20241117_143045.json
```

JSON logs include:
- Full operation history
- Timestamps
- File paths
- Summary statistics

## Running Tests

AppDater includes comprehensive tests to prevent critical bugs:

```bash
# Run all tests
cd appdata
python -m pytest tests/

# Run specific test
python -m pytest tests/test_validator.py

# Run with verbose output
python -m pytest tests/ -v
```

### Test Coverage

- `test_validator.py`: Filename validation, version tag detection
- `test_renamer.py`: Smart renaming, duplicate version prevention
- `test_duplicates.py`: Duplicate detection, newest file selection

## Architecture

```
appdata/
├── src/
│   ├── __init__.py
│   ├── cli.py                 # CLI entry point
│   ├── core/
│   │   ├── validator.py       # Filename validation
│   │   ├── renamer.py         # Smart renaming logic
│   │   └── duplicates.py      # Duplicate detection
│   ├── io/
│   │   ├── logger.py          # Safe logging
│   │   ├── config_loader.py   # YAML config
│   │   └── restore.py         # Restore script generation
│   ├── safety/
│   │   └── guardian.py        # Disk space & RAM checks
│   └── ui/
│       └── terminal.py        # Rich progress bars
├── tests/
│   ├── test_validator.py
│   ├── test_renamer.py
│   └── test_duplicates.py
└── config/
    └── default.yaml
```

## Critical Bug Fixes

AppDater implements fixes for critical bugs found in previous versions:

### Bug #1: Duplicate Version Tags
**Problem**: Files renamed multiple times created `_v_v_v` patterns

**Solution**: Validator checks if `_v` tag already exists before renaming

### Bug #2: System Crash (Disk Full)
**Problem**: System crashed when disk filled to 0%

**Solution**: Pre-flight disk space checks, abort if < 10GB free

### Bug #3: Incomplete Restore
**Problem**: Restore scripts didn't properly undo operations

**Solution**: Atomic restore scripts with reversed operation order

## Troubleshooting

### "CRITICAL: Only 8GB free!"

AppDater requires minimum 10GB free disk space. Free up space before running:

```bash
# Check disk space
df -h

# Find large files
du -sh * | sort -hr | head -10
```

### "File already has version tag"

File was already processed by AppDater. This is expected - the file is skipped to prevent duplicate tags.

### Restore Not Working

Make sure to run restore script from correct location:

```bash
# Navigate to directory where files are
cd /path/to/files

# Run restore script
bash /path/to/restore/Restore_XXXXXX.sh
```

## Contributing

To contribute to AppDater:

1. Follow the architecture guidelines
2. Add tests for new features
3. Run test suite before committing
4. Update documentation

## License

AppDater is provided as-is for managing macOS software images.

## Version

**Version**: 1.0.0
**Status**: Production Ready
**Date**: 2025-11-17

## Credits

Developed with lessons learned from managing 1704+ macOS software images.
