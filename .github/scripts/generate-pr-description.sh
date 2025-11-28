#!/bin/bash

set -e

OLD_VERSION=$1
NEW_VERSION=$2

if [ -z "$OLD_VERSION" ] || [ -z "$NEW_VERSION" ]; then
  echo "Error: Missing required parameters (old_version, new_version)"
  exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "Error: ANTHROPIC_API_KEY environment variable is not set"
  exit 1
fi

echo "Generating PR description using Claude AI..."

# Read diff report
if [ ! -f out/diff-report.json ]; then
  echo "Error: diff-report.json not found. Run generate-diff.sh first."
  exit 1
fi

DIFF_REPORT=$(cat out/diff-report.json)

# Build files summary for the prompt
FILES_SUMMARY=$(echo "$DIFF_REPORT" | jq -r '.files[] | "- \(.path): +\(.additions) -\(.deletions) lines"' | head -20)

# Build the prompt
PROMPT="Analyze the changes in WhatsApp Web protocol from version $OLD_VERSION to $NEW_VERSION.

Files changed:
$FILES_SUMMARY

Generate a PR description in markdown format with:
1. Summary (3-5 bullet points of main changes)
2. Detected issues (if any, like invalid JSON or significant breaking changes)
3. Impact for developers using this library

Be concise and objective. Focus on technical details."

# Create JSON payload for Claude API
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

# Call Claude API
RESPONSE=$(curl -s -X POST https://api.anthropic.com/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d "$PAYLOAD")

# Extract the text content from response
DESCRIPTION=$(echo "$RESPONSE" | jq -r '.content[0].text // "Failed to generate description"')

# Save to file
mkdir -p out
echo "$DESCRIPTION" > out/pr-description.md

echo "PR description generated successfully at out/pr-description.md"
