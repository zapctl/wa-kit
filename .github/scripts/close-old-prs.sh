#!/bin/bash

set -e

CURRENT_VERSION=$1

if [ -z "$CURRENT_VERSION" ]; then
  echo "Error: Missing required parameter (current_version)"
  exit 1
fi

echo "Closing old PRs for versions older than $CURRENT_VERSION..."

# Get directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# List PRs with update branches that are not the current version
gh pr list --head "update/v*" --json number,headRefName --jq '.[] | select(.headRefName != "update/v'"$CURRENT_VERSION"'") | .number' | while read PR; do
  if [ -n "$PR" ]; then
    echo "Closing PR #$PR..."

    # Get the version from the PR title
    OLD_VERSION=$(gh pr view $PR --json title --jq '.title' | grep -oP 'v\K[0-9.]+' || echo "")

    # Comment and close
    gh pr comment $PR --body "Closing: new version $CURRENT_VERSION detected"
    gh pr close $PR --delete-branch || echo "Failed to delete branch for PR #$PR"

    # Deprecate preview associated (if exists)
    if [ -n "$OLD_VERSION" ]; then
      echo "Deprecating preview versions for $OLD_VERSION..."
      bash "$SCRIPT_DIR/deprecate-preview.sh" "$OLD_VERSION" || echo "Failed to deprecate preview for $OLD_VERSION"
    fi
  fi
done

echo "Old PRs closed successfully."
