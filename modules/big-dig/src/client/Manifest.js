/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import crypto from 'crypto';
import path from 'path';

export type FileStats = {
  mode: number,
  uid: number,
  gid: number,
  size: number,
  mtime: number,
};

/**
 * Represents a "hash" of the state of a file tree. Ideally, comparing a stored manifest with a
 * current manifest created from the (current) state of the file tree will tell us if an
 * outside party has modified the contents of the file tree. ***This is only intended to detect
 * accidental changes.***
 *
 * The approach is to a hash the list of the files within the tree, along with some of their
 * `stats`, e.g. its last-modified time and file size. This does not hash the contents of the files
 * themselves. (The justification is that any change to the file is likely to also change its size
 * or last-modified time).
 */
export type Manifest = {
  version: string,
  hash: string,
};

/**
 * Convenience type to document how we expect a manifest to look when we read it from a file. But
 * without trusting that the structure is valid.
 */
type UntrustedManifest = {
  version?: string | any,
  hash?: string | any,
};

/**
 * Thrown when a manifest does not have a valid structure.
 */
export class CorruptManifestError extends Error {}

/**
 * Verifies that the manifest has a valid structure; throws `ManifestError` if not.
 * @param {*} manifest an (untrusted) manifest object.
 */
function verifyManifest(manifest: UntrustedManifest): Manifest {
  if (typeof manifest.version !== 'string') {
    throw corrupt('Invalid version in manifest');
  }
  if (typeof manifest.hash !== 'string') {
    throw corrupt('Invalid hash property in manifest');
  }
  const {version, hash} = manifest;
  return {version, hash};
}

/**
 * Creates a manifest from some observed state.
 * @param version The version to assign to the observed state.
 * @param manifestFilename The *absolute* path to the manifest; it is used to elide the manifest
 *    from itself.
 * @param basePath The *absolute* path to the root folder of the observed files.
 *    (Also used to elide the manifest from itself.)
 * @param files A list of all [sub]files and [sub]directories under `basePath`, paired with the
 *    output of `stat` on each file. These should be absolute paths.
 */
export function createManifest(
  version: string,
  manifestFilename: string,
  basePath: string,
  files: $ReadOnlyArray<{
    filename: string,
    +stats: FileStats & {isDirectory(): boolean},
  }>,
): Manifest {
  const hash = crypto.createHash('sha1');
  const sortedFiles = files
    // Exclude the manifest file and directories from the manifest.
    .filter(
      file => file.filename !== manifestFilename && !file.stats.isDirectory(),
    )
    .sort((a, b) => a.filename.localeCompare(b.filename));
  for (const file of sortedFiles) {
    const filename = path.relative(basePath, file.filename);
    const {mode, uid, gid, size, mtime} = file.stats;
    hash.update(`${filename}:${mode}.${uid}.${gid}.${size}.${mtime}`, 'utf8');
  }
  return {version, hash: hash.digest('hex')};
}

/**
 * Serializes the manifest into a `Buffer` that can be written to a manifest file.
 * @param manifest
 */
export function serializeManifest(manifest: Manifest): Buffer {
  return new Buffer(JSON.stringify(manifest), 'utf8');
}

/**
 * Deserialize data read from a manifest file and verify that it is a valid manifest.
 * Throws `ManifestError` if `data` does not encode a valid manifest structure.
 * @param data A buffer containing the manifest data loaded from a file.
 */
export function deserializeManifest(data: Buffer): Manifest {
  return verifyManifest(parseManifest(data.toString('utf8')));
}

export type ManifestCheckResult =
  | {|status: 'changed-files', message: string|}
  | {|status: 'diff-versions', message: string|}
  | {|status: 'equal'|};

/**
 * Compares two manifests for agreement on the state of the system.
 * NOTICE: equal manifests do not guarantee that the contents of a file has not changed.
 * Return a status of:
 *  * 'equal' if they agree on the state of the system.
 *  * 'diff-versions' if the manifests do not have the same version
 *  * 'changed-files' a file has been added, removed, or had its stats changed.
 *
 * @param expected The state we expect to see.
 * @param current The observed state.
 * @return `{status: 'okay'}` if the two manifests agree on the state of the system.
 */
export function compareManifests(
  expected: Manifest,
  current: Manifest,
): ManifestCheckResult {
  if (expected.version !== current.version) {
    return {status: 'diff-versions', message: 'Different versions'};
  } else if (expected.hash !== current.hash) {
    return {
      status: 'changed-files',
      message: 'Files are missing, have been added, or file-stats have changed',
    };
  }

  return {status: 'equal'};
}

function corrupt(message: string): CorruptManifestError {
  return new CorruptManifestError(message);
}

function parseManifest(data: string): UntrustedManifest {
  try {
    return JSON.parse(data);
  } catch (error) {
    throw corrupt('Manifest is not valid JSON syntax');
  }
}
