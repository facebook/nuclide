#!/bin/bash

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

set -e

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="v$(node -p 'require("./package.json").version')"

# When running in CircleCI:
#   * Verify that the release branch matches the `package.json` version.
#   * Check that `$ATOM_ACCESS_TOKEN` is set (used by `apm publish`).
#   * Check that `$NPM_TOKEN` is set (saved to ~/.npmrc for `npm publish`).
#   * Download and install atom/apm.
if [[ ! -z "$CI" ]]; then
  echo "Building branch:"
  echo "${CIRCLE_BRANCH}"

  if [[ "${CIRCLE_BRANCH}" != "release-${VERSION}" ]]; then
    echo "Expected build branch to be \"release-${VERSION}\"."
    exit 1
  fi

  if [[ -z "${NPM_TOKEN}" ]]; then
    echo "\$NPM_TOKEN is not set."
    exit 1
  else
    echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
    unset NPM_TOKEN
  fi

  if [[ -z "${ATOM_ACCESS_TOKEN}" ]]; then
    echo "\$ATOM_ACCESS_TOKEN is not set."
    exit 1
  fi

  # This info isn't set in CircleCI
  git config --get user.email || git config user.email "zertosh@gmail.com"
  git config --get user.name || git config user.name "Andres Suarez"

  # Excerpts from https://github.com/atom/ci/blob/5587d0e/build-package.sh
  echo "Downloading latest Atom release..."
  if [ "${CIRCLECI}" = "true" ]; then
    curl -s -L "https://github.com/atom/atom/releases/download/v1.28.2/atom-amd64.deb" \
      -H 'Accept: application/octet-stream' \
      -o "atom-amd64.deb"
    sudo dpkg --install atom-amd64.deb || true
    sudo apt-get update >/dev/null
    sudo apt-get -f install
    sudo rm atom-amd64.deb
  else
    echo "Unknown CI environment, exiting!"
    exit 1
  fi
fi

echo "Using APM version:"
apm -v

if ! apm stars >/dev/null; then
  echo "Not logged in to apm."
  exit 1
fi
if ! npm whoami >/dev/null; then
  echo "Not logged in to npm."
  exit 1
fi
if ! git config --get user.email >/dev/null; then
  echo "Git \"user.email\" not set."
  exit 1
fi
if ! git config --get user.name >/dev/null; then
  echo "Git \"user.name\" not set."
  exit 1
fi

# Force a detached HEAD
git checkout "$(git rev-parse HEAD)"

"$THIS_DIR/../scripts/release-generate-proxies.js" --save
NUCLIDE_TRANSPILE_ENV=production npm run release-transpile -- --overwrite
"$THIS_DIR/../scripts/prepare-apm-release.js"

git ls-files --ignored --exclude-standard -z | xargs -0 git rm --cached
git add -A && git commit -F- <<EOF
Release ${VERSION}

This commit is the built version of Nuclide suitable for apm and npm.
EOF

git tag "${VERSION}"
git push origin "${VERSION}"

npm publish

apm publish --tag "${VERSION}"
