#!/bin/bash

cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found."
  echo "Install Node.js 20 or newer from https://nodejs.org/, then run this file again."
  open "https://nodejs.org/"
  read -r -p "Press Return to close this window..."
  exit 1
fi

echo "Starting Coach Greene's SystemCore Sim..."
echo "Keep this window open while using the simulator."
(sleep 1 && open "http://localhost:4173") &
exec node server.mjs
