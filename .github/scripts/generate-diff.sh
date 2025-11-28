#!/bin/bash

set -e

OLD_VERSION=$1
NEW_VERSION=$2

if [ -z "$OLD_VERSION" ] || [ -z "$NEW_VERSION" ]; then
  echo "Error: Missing required parameters (old_version, new_version)"
  exit 1
fi

echo "Generating diff report from v$OLD_VERSION to v$NEW_VERSION..."

# Create out directory if it doesn't exist
mkdir -p out

# Find the commit for the old version
OLD_COMMIT=$(git log --all --grep="v$OLD_VERSION" --format="%H" -n 1 || echo "")

if [ -z "$OLD_COMMIT" ]; then
  echo "Warning: Could not find commit for v$OLD_VERSION. Using HEAD~1 as fallback."
  OLD_COMMIT="HEAD~1"
fi

# Initialize JSON report
echo "{" > out/diff-report.json
echo "  \"old_version\": \"$OLD_VERSION\"," >> out/diff-report.json
echo "  \"new_version\": \"$NEW_VERSION\"," >> out/diff-report.json
echo "  \"files\": [" >> out/diff-report.json

FIRST=true

# Compare files in out/ (excluding out/dist/)
for FILE in out/*.json out/graphql/* out/protobuf/*; do
  if [ -f "$FILE" ] && [[ ! "$FILE" =~ out/dist/ ]]; then
    # Get diff stats
    ADDITIONS=$(git diff $OLD_COMMIT HEAD -- "$FILE" | grep -c "^+" | tail -1 || echo "0")
    DELETIONS=$(git diff $OLD_COMMIT HEAD -- "$FILE" | grep -c "^-" | tail -1 || echo "0")

    # Adjust for diff header lines
    if [ "$ADDITIONS" -gt 0 ]; then
      ADDITIONS=$((ADDITIONS - 1))
    fi
    if [ "$DELETIONS" -gt 0 ]; then
      DELETIONS=$((DELETIONS - 1))
    fi

    # Validate JSON if it's a .json file
    VALID_JSON=false
    if [[ "$FILE" =~ \.json$ ]]; then
      if jq empty "$FILE" 2>/dev/null; then
        VALID_JSON=true
      fi
    else
      VALID_JSON=true  # Non-JSON files are considered "valid"
    fi

    # Add comma if not first entry
    if [ "$FIRST" = false ]; then
      echo "    ," >> out/diff-report.json
    fi
    FIRST=false

    # Write entry
    echo "    {" >> out/diff-report.json
    echo "      \"path\": \"$FILE\"," >> out/diff-report.json
    echo "      \"additions\": $ADDITIONS," >> out/diff-report.json
    echo "      \"deletions\": $DELETIONS," >> out/diff-report.json
    echo "      \"valid_json\": $VALID_JSON" >> out/diff-report.json
    echo -n "    }" >> out/diff-report.json
  fi
done

# Close JSON
echo "" >> out/diff-report.json
echo "  ]" >> out/diff-report.json
echo "}" >> out/diff-report.json

# Validate the final JSON
if jq empty out/diff-report.json 2>/dev/null; then
  echo "Diff report generated successfully at out/diff-report.json"
else
  echo "Error: Generated invalid JSON"
  exit 1
fi
