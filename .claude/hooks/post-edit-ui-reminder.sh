#!/bin/bash
# Hook: Remind user to run visual tests after UI component edits
# Triggered by PostToolUse on Edit/Write tools

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Check if the edited file is a UI-related file
if [[ "$file_path" == *"/components/"* ]] || \
   [[ "$file_path" == *"/screens/"* ]] || \
   [[ "$file_path" == *".css"* ]] || \
   [[ "$file_path" == *".scss"* ]] || \
   [[ "$file_path" == *"/styles/"* ]]; then
    echo '{"systemMessage": "UI component edited. Consider running /test-visual to verify changes."}'
fi
