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

/* eslint-disable nuclide-internal/no-commonjs */
/* eslint-disable nuclide-internal/consistent-import-name */

const path = require('path');
const fs = require('fs-extra');
const {spawnSync} = require('child_process');
const os = require('os');
const chalk = require('chalk');

const NUCLIDE_PACKAGE_JSON_PATH = path.resolve(__dirname, '../package.json');
const ATOM_HOME = path.join(os.homedir(), '.atom');
const ATOM_PACKAGES = path.join(ATOM_HOME, 'packages');
const THIRD_PARTY_DIR = path.resolve(__dirname, '../jest/third_party');
const TAR_PATH = path.join(THIRD_PARTY_DIR, 'apm_deps.tar.gz');

// $FlowFixMe
const NUCLIDE_PACKAGE_JSON = require(NUCLIDE_PACKAGE_JSON_PATH);
const {'package-deps': packageDeps} = NUCLIDE_PACKAGE_JSON;

fs.removeSync(TAR_PATH);
fs.mkdirpSync(THIRD_PARTY_DIR);

packageDeps.forEach(pkg => {
  const pkgPath = path.join(ATOM_PACKAGES, pkg);
  const exists = fs.existsSync(pkgPath);
  if (!exists) {
    throw new Error(`
        can't find atom package '${pkg}' in '${pkgPath}'.
        before you can pack all nuclide dependencies make sure you have
        all apm packages installed in '${ATOM_PACKAGES}'
      `);
  }
});

spawnSync('tar', ['cvfz', TAR_PATH, ...packageDeps], {
  stdio: 'inherit',
  cwd: ATOM_PACKAGES,
});

// eslint-disable-next-line no-console
console.log(
  '\n\n',
  chalk.green(`created a tar with APM packages in ${TAR_PATH}`),
);
