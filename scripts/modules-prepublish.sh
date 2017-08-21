#!/bin/bash

# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

set -e

OWN_DIR=$(dirname "$0")
CALLING_DIR="$(pwd -P)"

echo "Module prepublish: making copies for flow (1 / 2)..."
find "$CALLING_DIR" \
  -name '*.js' \
  -not -path '*/spec*' -exec cp -n {} {}.flow \;

echo "Module prepublish: compiling source (2 / 2) ..."
"$OWN_DIR/release-transpile.js" --overwrite "$CALLING_DIR"
rm -f DEVELOPMENT
