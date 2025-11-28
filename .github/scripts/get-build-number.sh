#!/bin/bash

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Error: Missing required parameter (version)"
  exit 1
fi

echo "Determining build number for version $VERSION..."

# Search for existing PR with this version
PR_NUMBER=$(gh pr list --head "update/v$VERSION" --json number --jq '.[0].number // empty' || echo "")

if [ -z "$PR_NUMBER" ]; then
  # No existing PR, this is build 1
  echo "BUILD=1"
  echo "IS_NEW=true"
  echo "PR_NUMBER="
else
  # PR exists, increment build number
  echo "Found existing PR #$PR_NUMBER"

  # Extract current build from label
  CURRENT_BUILD=$(gh pr view $PR_NUMBER --json labels --jq '.labels[] | select(.name | startswith("build:")) | .name | split(":")[1] // "0"' || echo "0")

  if [ -z "$CURRENT_BUILD" ] || [ "$CURRENT_BUILD" = "null" ]; then
    CURRENT_BUILD=0
  fi

  NEW_BUILD=$((CURRENT_BUILD + 1))

  echo "BUILD=$NEW_BUILD"
  echo "IS_NEW=false"
  echo "PR_NUMBER=$PR_NUMBER"
fi
