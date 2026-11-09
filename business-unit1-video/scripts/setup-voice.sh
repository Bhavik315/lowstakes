#!/usr/bin/env bash
# One-time setup for the local voiceover engine (Kokoro-82M, Apache-2.0).
set -euo pipefail
cd "$(dirname "$0")"
pip install kokoro-onnx soundfile numpy scipy
mkdir -p .models
base=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
[ -f .models/kokoro-v1.0.onnx ] || curl -L -o .models/kokoro-v1.0.onnx "$base/kokoro-v1.0.onnx"
[ -f .models/voices-v1.0.bin ] || curl -L -o .models/voices-v1.0.bin "$base/voices-v1.0.bin"
echo "Voice engine ready. Run: npm run voice"
