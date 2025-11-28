#!/bin/bash

set -e

BASE_VERSION=$1

if [ -z "$BASE_VERSION" ]; then
  echo "Error: Missing required parameter (base_version)"
  exit 1
fi

echo "Deprecating preview versions for base version $BASE_VERSION..."

# List all versions preview for the base version and deprecate them
npm view $PACKAGE_NAME versions --json | jq -r '.[]' | grep "$BASE_VERSION-preview" | while read VERSION; do
  echo "Deprecating $PACKAGE_NAME@$VERSION..."
  npm deprecate "$PACKAGE_NAME@$VERSION" "Preview version deprecated after merge to main"
done

echo "All preview versions for $BASE_VERSION have been deprecated."
