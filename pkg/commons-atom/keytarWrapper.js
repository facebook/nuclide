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

import child_process from 'child_process';
import nuclideUri from 'nuclide-commons/nuclideUri';
import semver from 'semver';

// KeyTar<=3.x APM<1.18
const getPasswordScriptSync = `
  var readline = require('readline');
  var keytar = require('keytar');
  var rl = readline.createInterface({input: process.stdin});
  rl.on('line', function(input) {
    var data = JSON.parse(input);
    var password = keytar.getPassword(data.service, data.account);
    console.log(JSON.stringify(password));
    rl.close();
  });
`;

// KeyTar<=3.x APM<1.18
const replacePasswordScriptSync = `
  var readline = require('readline');
  var keytar = require('keytar');
  var rl = readline.createInterface({input: process.stdin});
  rl.on('line', function(input) {
    var data = JSON.parse(input);
    var result = keytar.replacePassword(data.service, data.account, data.password);
    console.log(JSON.stringify(result));
    rl.close();
  });
`;

// KeyTar<=3.x APM<1.18
const deletePasswordScriptSync = `
  var readline = require('readline');
  var keytar = require('keytar');
  var rl = readline.createInterface({input: process.stdin});
  rl.on('line', function(input) {
    var data = JSON.parse(input);
    var result = keytar.deletePassword(data.service, data.account);
    console.log(JSON.stringify(result));
    rl.close();
  });
`;

// KeyTar>=4.x APM>=1.18
const getPasswordScriptAsync = `
  var readline = require('readline');
  var keytar = require('keytar');
  var rl = readline.createInterface({input: process.stdin});
  rl.on('line', function(input) {
    var data = JSON.parse(input);
    keytar.getPassword(data.service, data.account).then(function(password) {
      console.log(JSON.stringify(password));
      rl.close();
    }, function() {
      console.log(null);
      rl.close();
    });
  });
`;

// KeyTar>=4.x APM>=1.18
const replacePasswordScriptAsync = `
  var readline = require('readline');
  var keytar = require('keytar');
  var rl = readline.createInterface({input: process.stdin});
  rl.on('line', function(input) {
    var data = JSON.parse(input);
    keytar.setPassword(data.service, data.account, data.password).then(function() {
      console.log(JSON.stringify(true));
    }, function() {
      console.log(JSON.stringify(false));
    })
    .then(rl.close.bind(rl), rl.close.bind(rl))
  });
`;

// KeyTar>=4.x APM>=1.18
const deletePasswordScriptAsync = `
  var readline = require('readline');
  var keytar = require('keytar');
  var rl = readline.createInterface({input: process.stdin});
  rl.on('line', function(input) {
    var data = JSON.parse(input);
    keytar.deletePassword(data.service, data.account).then(function(result) {
      console.log(JSON.stringify(result));
    }, function() {
      console.log(JSON.stringify(false));
    })
    .then(rl.close.bind(rl), rl.close.bind(rl))
  });
`;

function isAsyncKeytar(): boolean {
  return semver.gte(atom.getVersion(), '1.18.0-beta0');
}

function getApmNodePath(): string {
  const apmDir = nuclideUri.dirname(atom.packages.getApmPath());
  return nuclideUri.normalize(nuclideUri.join(apmDir, 'node'));
}

function getApmNodeModulesPath(): string {
  const apmDir = nuclideUri.dirname(atom.packages.getApmPath());
  return nuclideUri.normalize(nuclideUri.join(apmDir, '..', 'node_modules'));
}

function runScriptInApmNode(
  script: string,
  service: string,
  account: string,
  password?: string,
): string {
  const args = ['-e', script];
  const options = {
    // The newline is important so we can use readline's line event.
    input: JSON.stringify({service, account, password}) + '\n',
    env: {
      ...process.env,
      NODE_PATH: getApmNodeModulesPath(),
    },
  };
  const output = child_process.spawnSync(getApmNodePath(), args, options);
  return output.stdout.toString();
}

export default {
  getPassword(service: string, account: string): ?string {
    return JSON.parse(
      runScriptInApmNode(
        isAsyncKeytar() ? getPasswordScriptAsync : getPasswordScriptSync,
        service,
        account,
      ),
    );
  },

  replacePassword(
    service: string,
    account: string,
    password: string,
  ): ?boolean {
    return JSON.parse(
      runScriptInApmNode(
        isAsyncKeytar()
          ? replacePasswordScriptAsync
          : replacePasswordScriptSync,
        service,
        account,
        password,
      ),
    );
  },

  deletePassword(service: string, account: string): ?boolean {
    return JSON.parse(
      runScriptInApmNode(
        isAsyncKeytar() ? deletePasswordScriptAsync : deletePasswordScriptSync,
        service,
        account,
      ),
    );
  },
};

export const __TEST__ = {
  getApmNodeModulesPath,
  getApmNodePath,
  runScriptInApmNode,
};
