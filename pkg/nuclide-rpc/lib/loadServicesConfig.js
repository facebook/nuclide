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
import nuclideUri from 'nuclide-commons/nuclideUri';

import type {ConfigEntry} from '../../nuclide-rpc';

/**
 * Load service configs, and resolve all of the paths to absolute paths.
 */
export default function loadServicesConfig(
  dirname: string,
): Array<ConfigEntry> {
  return [
    nuclideUri.resolve(dirname, './services-3.json'),
    nuclideUri.resolve(dirname, './fb-services-3.json'),
  ].reduce((acc, servicePath) => {
    if (fs.existsSync(servicePath)) {
      const basedir = nuclideUri.dirname(servicePath);
      const src = fs.readFileSync(servicePath, 'utf8');
      const jsonConfig: Array<Object> = JSON.parse(src);
      acc.push(...createServiceConfigObject(basedir, jsonConfig));
    }
    return acc;
  }, []);
}

/**
 * Takes the contents of a service config JSON file, and formats each entry into
 * a ConfigEntry.
 * Service paths must either be absolute or relative to the service config
 * config file.
 */
function createServiceConfigObject(
  basedir: string,
  jsonConfig: Array<Object>,
): Array<ConfigEntry> {
  return jsonConfig.map(config => {
    return {
      name: config.name,
      // TODO(peterhal): Remove this once all services have had their def files removed.
      definition: nuclideUri.resolve(
        basedir,
        config.definition || config.implementation,
      ),
      implementation: nuclideUri.resolve(basedir, config.implementation),
      preserveFunctionNames: config.preserveFunctionNames === true,
    };
  });
}
