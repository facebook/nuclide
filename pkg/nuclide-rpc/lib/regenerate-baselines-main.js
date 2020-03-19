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

// Regenerates the .proxy baseline files in the spec/fixtures directory.

import * as t from '@babel/types';
// eslint-disable-next-line nuclide-internal/no-unresolved
import generate from '@babel/generator';
import {parseServiceDefinition} from './service-parser';
import createProxyGenerator from './proxy-generator';
import {stripLocationsFileName} from './location';
import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';

const {generateProxy} = createProxyGenerator(t, generate);

const dir = nuclideUri.join(__dirname, '../spec/fixtures');
for (const file of fs.readdirSync(dir)) {
  if (file.endsWith('.def')) {
    const serviceName = nuclideUri.basename(file, '.def');
    const preserveFunctionNames = false;
    const definitionPath = nuclideUri.join(dir, file);

    const definitionSource = fs.readFileSync(definitionPath, 'utf8');
    const definitions = parseServiceDefinition(
      definitionPath,
      definitionSource,
      [],
    );

    stripLocationsFileName(definitions);

    fs.writeFileSync(
      definitionPath.replace('.def', '.def.json'),
      JSON.stringify(definitions, null, 4),
      'utf8',
    );

    const code = generateProxy(serviceName, preserveFunctionNames, definitions);
    fs.writeFileSync(definitionPath.replace('.def', '.proxy'), code, 'utf8');
  }
}
