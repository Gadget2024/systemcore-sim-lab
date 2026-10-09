#!/bin/bash

# Run from the folder containing this launcher, even when opened from Finder.
cd -- "$(dirname -- "$0")" || exit 1
# Finder may not include these common Node installation locations in PATH.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found."
  echo "Install Node.js 20 or newer from https://nodejs.org/, then run this file again."
  open "https://nodejs.org/"
  read -r -p "Press Return to close this window..."
  exit 1
fi

if [ ! -d node_modules/ws ] || [ ! -d node_modules/@msgpack/msgpack ]; then
  echo "Install the project packages first: open Terminal in this folder and run npm ci."
  read -r -p "Press Return to close this window..."
  exit 1
fi

echo "Starting Coach Greene's SystemCore Sim..."
echo "Keep this window open while using the simulator."
# Open the page after giving Node a moment to start; keep this window running.
(sleep 1 && open "http://localhost:4173") &
exec node server.mjs
