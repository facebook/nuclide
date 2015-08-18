'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var {findDiagnostics} = require('./hack');
var {HACK_GRAMMAR} = require('nuclide-hack-common/lib/constants');

module.exports = {
  providerName: 'Hack',
  grammarScopes: [HACK_GRAMMAR],
  scope: 'file',
  lintOnFly: true,
  async lint(textEditor: TextEditor): Promise<Array<Object>> {
    var diagnostics = await findDiagnostics(textEditor);
    return diagnostics.length ? diagnostics : [];
  },
};
