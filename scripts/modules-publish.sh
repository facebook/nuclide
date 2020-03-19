#!/bin/bash

set -e

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$THIS_DIR/.."
LERNA_VERSION="$(node -p "require('$ROOT_DIR/lerna.json').version")"
LERNA_VERSION="${LERNA_VERSION/-dev/}"

if [[ ! -z "$CI" ]]; then
  if [[ -z "${MODULES_NPM_TOKEN}" ]]; then
    echo "\$MODULES_NPM_TOKEN is not set."
    exit 1
  else
    echo "//registry.npmjs.org/:_authToken=${MODULES_NPM_TOKEN}" > ~/.npmrc
    unset MODULES_NPM_TOKEN
  fi
fi

echo "Publishing modules version $LERNA_VERSION with Lerna"
(
  cd "$ROOT_DIR"
  node_modules/.bin/lerna publish --yes --skip-git --repo-version "$LERNA_VERSION"
)
