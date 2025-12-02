#!/bin/bash

set -e

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "Error: ANTHROPIC_API_KEY environment variable is not set"
  exit 1
fi

if [ ! -f out/report.diff ]; then
  echo "Error: out/report.diff not found."
  exit 1
fi

CHANGED_FILES=$(cat out/changed-files.diff)
DIFF_REPORT=$(cat out/report.diff)

echo "Generating PR description using Claude AI..."

PROMPT="Analyze the changes in WhatsApp Web protocol from version $VERSION to $NEWEST_VERSION.

Generate a PR description in markdown format with:
1. Summary (3-5 bullet points of main changes)
2. Detected issues (if any, like invalid JSON or significant breaking changes)
3. Impact for developers using this library

Be concise and objective. Focus on technical details.

Files changed:
$CHANGED_FILES

git diff HEAD:
$DIFF_REPORT
"

PAYLOAD=$(jq -n \
  --arg prompt "$PROMPT" \
  '{
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: $prompt
      }
    ]
  }')

RESPONSE=$(curl -s -X POST https://api.anthropic.com/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d "$PAYLOAD")

echo "$RESPONSE"

DESCRIPTION=$(echo "$RESPONSE" | jq -r '.content[0].text // "Failed to generate description"')

echo "$DESCRIPTION" > out/pr-description.md
echo "PR description generated successfully at out/pr-description.md"