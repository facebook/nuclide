/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {ComponentDefinition} from '../../../nuclide-ui-component-tools-common/lib/types';
import type {ConfigFromFlow} from '../Config';
import type {JSExport} from './types';

import crypto from 'crypto';
import nuclideUri from 'nuclide-commons/nuclideUri';
import os from 'os';
import DiskCache from '../../../commons-node/DiskCache';
import {serializeConfig} from '../Config';

const CACHE_DIR = nuclideUri.join(os.tmpdir(), 'nuclide-js-imports-cache');
const CACHE_VERSION = 5; // Bump this for any breaking changes.

export type CacheParams = {
  root: string,
  configFromFlow: ConfigFromFlow,
};

export type FileWithHash = {
  filePath: string,
  sha1: string,
};

export type CacheValue = {|
  exports: Array<JSExport>,
  componentDefinition?: ComponentDefinition,
|};

function getCachePath({root, configFromFlow}: CacheParams): string {
  const hash = crypto.createHash('sha1');
  hash.update(`${root}:${CACHE_VERSION}\n`);
  hash.update(serializeConfig(configFromFlow));
  const fileName =
    nuclideUri.basename(root) + '-' + hash.digest('hex').substr(0, 8);
  return nuclideUri.join(CACHE_DIR, fileName);
}

function getCacheKey({filePath, sha1}: FileWithHash) {
  // We can truncate the sha1 hash, as collisions are very unlikely.
  return `${filePath}:${sha1.substr(0, 8)}`;
}

export default class ExportCache extends DiskCache<FileWithHash, CacheValue> {
  constructor(params: CacheParams) {
    super(getCachePath(params), getCacheKey);
  }
}
