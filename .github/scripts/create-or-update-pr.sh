#!/bin/bash

set -e

OLD_VERSION=$1
NEW_VERSION=$2
BUILD=$3
PUBLISH_STATUS=$4

if [ -z "$OLD_VERSION" ] || [ -z "$NEW_VERSION" ] || [ -z "$BUILD" ] || [ -z "$PUBLISH_STATUS" ]; then
  echo "Error: Missing required parameters (old_version, new_version, build, publish_status)"
  exit 1
fi

BRANCH_NAME="update/v$NEW_VERSION"
PREVIEW_VERSION="$NEW_VERSION-preview.$BUILD"

# Check if PR description exists
if [ ! -f out/pr-description.md ]; then
  echo "Error: PR description not found at out/pr-description.md"
  exit 1
fi

# Check if this is a new PR or update
PR_NUMBER=$(gh pr list --head "$BRANCH_NAME" --json number --jq '.[0].number // empty' || echo "")

if [ -z "$PR_NUMBER" ]; then
  echo "Creating new PR for version $NEW_VERSION..."

  # Create and push branch
  git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
  git add out/
  git commit -m "Update WhatsApp Web to v$NEW_VERSION" || echo "No changes to commit"
  git push -u origin "$BRANCH_NAME" --force

  # Create PR with description
  PR_URL=$(gh pr create \
    --title "WhatsApp Web v$NEW_VERSION" \
    --body-file out/pr-description.md \
    --label "whatsapp-update" \
    --label "build:$BUILD" \
    --base main)

  echo "PR created: $PR_URL"

  # Add comment about preview
  if [ "$PUBLISH_STATUS" = "success" ]; then
    gh pr comment --body "✅ Preview version \`$PREVIEW_VERSION\` published successfully to NPM"
  else
    gh pr comment --body "❌ Preview version \`$PREVIEW_VERSION\` failed to publish. Check workflow logs for details."
  fi

else
  echo "Updating existing PR #$PR_NUMBER..."

  # Update branch
  git checkout "$BRANCH_NAME"
  git pull origin "$BRANCH_NAME" || echo "Could not pull, continuing..."
  git add out/
  git commit -m "Update build $BUILD" || echo "No changes to commit"
  git push origin "$BRANCH_NAME"

  # Update PR body
  gh pr edit $PR_NUMBER --body-file out/pr-description.md

  # Remove old build label and add new one
  OLD_BUILD_LABELS=$(gh pr view $PR_NUMBER --json labels --jq '.labels[] | select(.name | startswith("build:")) | .name')
  for LABEL in $OLD_BUILD_LABELS; do
    gh pr edit $PR_NUMBER --remove-label "$LABEL" || echo "Could not remove label $LABEL"
  done
  gh pr edit $PR_NUMBER --add-label "build:$BUILD"

  # Add comment about new build
  if [ "$PUBLISH_STATUS" = "success" ]; then
    gh pr comment $PR_NUMBER --body "✅ New build: \`$PREVIEW_VERSION\` published successfully to NPM"
  else
    gh pr comment $PR_NUMBER --body "❌ New build: \`$PREVIEW_VERSION\` failed to publish. Check workflow logs for details."
  fi

  echo "PR updated: https://github.com/$(gh repo view --json nameWithOwner --jq .nameWithOwner)/pull/$PR_NUMBER"
fi

# Return to main branch
git checkout main
