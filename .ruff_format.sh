#!/bin/bash
# Automatic ruff formatting script for Python files
# Usage: ./.ruff_format.sh [file1.py] [file2.py] ...
# If no files specified, formats all Python files in project

export PATH="$HOME/.local/bin:$PATH"

if [ $# -eq 0 ]; then
    echo "🔧 Running ruff check and format on all Python files..."
    ruff check --fix .
    ruff format .
    echo "✅ All Python files formatted and linted"
else
    echo "🔧 Running ruff check and format on specified files..."
    for file in "$@"; do
        if [[ "$file" == *.py ]]; then
            echo "Processing: $file"
            ruff check --fix "$file"
            ruff format "$file"
        else
            echo "Skipping non-Python file: $file"
        fi
    done
    echo "✅ Specified Python files formatted and linted"
fi
