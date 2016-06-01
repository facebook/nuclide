'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import path from 'path';
import type {ConfigEntry} from '../../nuclide-rpc';

const PACKAGE_ROOT = path.resolve(__dirname, '..');

/**
 * Load service configs, and resolve all of the paths to absolute paths.
 */
export function loadServicesConfig(): Array<ConfigEntry> {
  const publicServices = createServiceConfigObject(require('../services-3.json'));
  let privateServices = [];
  try {
    // $FlowFB
    privateServices = createServiceConfigObject(require('../fb/fb-services-3.json'));
  } catch (e) {
    // This file may not exist.
  }
  return publicServices.concat(privateServices);
}

/**
 * Takes the contents of a service config JSON file, and formats each entry into
 * a ConfigEntry.
 */
function createServiceConfigObject(jsonConfig: Array<Object>): Array<ConfigEntry> {
  return jsonConfig.map(config => {
    // TODO(peterhal): Remove this once all services have had their def files removed.
    if (config.definition == null) {
      config.definition = config.implementation;
    }
    return {
      name: config.name,
      definition: resolveServicePath(config.definition),
      implementation: resolveServicePath(config.implementation),
    };
  });
}

/**
 * Resolve service path defined in services-3.json to absolute path. The service path could
 * be in one of following forms:
 *   1. A path relative to the folder that contains `service-config.json`.
 *   2. An absolute path.
 *   3. A path in form of `$dependency_package/path/to/service`. For example,
 *      'commons-node/collection.js'.
 */
function resolveServicePath(servicePath: string): string {
  try {
    return require.resolve(servicePath);
  } catch (e) {
    return path.resolve(PACKAGE_ROOT, servicePath);
  }
}
