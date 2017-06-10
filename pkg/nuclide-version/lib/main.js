/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import fs from 'fs';
import invariant from 'assert';

// Use a regex and not the "semver" module so the result here is the same
// as from python code.
const SEMVERISH_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([a-z0-9.-]+))?$/;
let version;

/*
 * This is the versioning of Nuclide client-server protocol.
 * It is not a communication protocol per se. It is the sum of communication and
 * services API.
 *
 * First, no commit shall break the protocol in that client and server
 * from the same master shall always work with each other.
 * That means, no client new feature shall be enabled before the dependent
 * server serice is in place, while it is OK to add a new server service before
 * the client is ready.
 *
 * Rule number two. Every commit that breaks the backward compatibility shall
 * bump the version in package.json. This includes any client changes
 * (new feature or whatever) that do not work with the older servers.
 * It also includes server changes that break older clients.
 */
export function getVersion(): string {
  if (!version) {
    // Don't use require() because it may be reading from the module cache.
    // Do use require.resolve so the paths can be codemoded in the future.
    const pkgFilename = require.resolve('../../../package.json');
    const pkgJson = JSON.parse(fs.readFileSync(pkgFilename, 'utf8'));
    const match = SEMVERISH_RE.exec(pkgJson.version);
    invariant(match);
    // const majorVersion = match[1];
    const minorVersion = match[2];
    // const patchVersion = match[3];
    // const prereleaseVersion = match[4];
    version = minorVersion;
  }
  return version;
}
