# Data Protection Plugin

This plugin protects critical data files (ML checkpoints, training results, model weights) from accidental overwrites by prompting for user confirmation before Write operations.

## Overview

When Claude Code attempts to write to a file that:
1. Already exists on disk, AND
2. Matches protected file patterns (ML model files, training outputs, etc.)

The plugin will block the operation and prompt the user for explicit confirmation before proceeding.

## Protected File Types

### ML Model Files
- `.pt`, `.pth` - PyTorch models
- `.ckpt` - Model checkpoints
- `.h5`, `.pb` - Keras/TensorFlow models
- `.onnx` - ONNX models
- `.pkl`, `.joblib` - Serialized Python objects
- `.safetensors` - Safe tensor format
- `.mlmodel` - Core ML models
- `.engine` - TensorRT engines
- `.msgpack` - MessagePack serialized data

### Dataset Files
- `.npy`, `.npz` - NumPy arrays
- `.hdf5`, `.hdf` - HDF5 datasets
- `.parquet` - Parquet data files

### Training Outputs
- `results.csv`, `metrics.csv`
- `training_log.txt`
- `loss_curve.png`, `accuracy_curve.png`
- `*loss*.png`, `*accuracy*.png` (any file with loss/accuracy in name)
- `checkpoint.pth`, `checkpoint.pt`, `checkpoint.ckpt`
- `best_model.pth`, `best_model.pt`, `best_model.ckpt`
- `train_history.json`, `val_history.json`, `history.json`
- `config.yaml`, `config.yml` (training configs)

### Checkpoint Patterns
- Files matching `*checkpoint*.pth`, `*checkpoint*.pt`, `*checkpoint*.ckpt`
- Files matching `*epoch*.pth`, `*epoch*.pt`
- Files matching `*step*.pth`, `*step*.pt`

## How It Works

The plugin uses a PreToolUse hook that intercepts Write operations:

1. When Claude Code attempts to write a file, the hook checks if the file:
   - Already exists (to avoid blocking new file creation)
   - Matches any protected file patterns
2. If both conditions are true, the operation is blocked
3. A warning message is displayed explaining what file would be overwritten
4. User is prompted for explicit confirmation to proceed

## Usage

This plugin is automatically loaded when Claude Code starts. No explicit configuration needed.

### Disabling the Plugin

If you need to temporarily disable data protection, you can set an environment variable:

```bash
DATA_PROTECTION_ENABLED=0 claude
```

Or in your shell profile:
```bash
export DATA_PROTECTION_ENABLED=0
```

## Installation

This plugin is included in the Claude Code plugins directory. To use it in your project:

1. Navigate to your project directory
2. Run Claude Code
3. The plugin is automatically active

## Use Cases

This plugin prevents accidental data loss from:
- Overwriting PyTorch model checkpoints after hours of training
- Destroying training metrics and results
- Losing progress on long-running ML experiments
- Accidentally overwriting serialized datasets

## Rationale

Large ML training runs can take 16-36+ hours on GPUs. Accidentally overwriting a checkpoint file means losing all that compute time. This plugin adds a safety checkpoint to prevent such losses.
