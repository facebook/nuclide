/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 */
'use strict';

/* eslint
  comma-dangle: [1, always-multiline],
  prefer-object-spread/prefer-object-spread: 0,
  rulesdir/no-commonjs: 0,
  */

const path = require('path');
const fs = require('fs');

const rule = require('../flow-fb-oss');
const temp = require('temp');
temp.track();
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester({
  parser: 'babel-eslint',
});

const TEST_DIR_PATH = temp.mkdirSync();
const OSS_FILE_PATH_1 = path.join(TEST_DIR_PATH, 'index.js');
const OSS_FILE_PATH_2 = path.join(TEST_DIR_PATH, 'util.js');
const FB_FILE_PATH_1 = path.join(TEST_DIR_PATH, 'fb-file-1.js');
const FB_DIR_PATH = path.join(TEST_DIR_PATH, 'fb');
const FB_FILE_PATH_2 = path.join(FB_DIR_PATH, 'file-2.js');

init();
testRule();

function init() {
  fs.writeFileSync(OSS_FILE_PATH_1, '');
  fs.writeFileSync(OSS_FILE_PATH_2, '');
  fs.writeFileSync(FB_FILE_PATH_1, '');
  fs.mkdirSync(FB_DIR_PATH);
  fs.writeFileSync(FB_FILE_PATH_2, '');
}

function testRule() {
  ruleTester.run('flow-fb-oss', rule, {
    valid: [
      {
        code: 'require("path");',
        filename: OSS_FILE_PATH_1,
      },
      {
        code: 'require("./util");',
        filename: OSS_FILE_PATH_1,
      },
      {
        code: '// $FlowFB\nrequire("./fb-file-1");',
        filename: OSS_FILE_PATH_1,
      },
      {
        code: '// $FlowFB\nrequire("./fb/file-2");',
        filename: OSS_FILE_PATH_1,
      },
      {
        code: 'require("./index");',
        filename: FB_FILE_PATH_1,
      },
      {
        code: 'require("./fb/fb-file-2");',
        filename: FB_FILE_PATH_1,
      },
    ],
    invalid: [
      {
        code: 'require("./fb-file-1");',
        filename: OSS_FILE_PATH_1,
        errors: [
          {
            message: 'fb-only requires must have a line comment `// $FlowFB` above',
            type: 'CallExpression',
          },
        ],
      },
      {
        code: 'require("./fb/file-2");',
        filename: OSS_FILE_PATH_1,
        errors: [
          {
            message: 'fb-only requires must have a line comment `// $FlowFB` above',
            type: 'CallExpression',
          },
        ],
      },
    ],
  });
}
