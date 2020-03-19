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

/* eslint
  no-console: 0,
 */

import fsPromise from 'nuclide-commons/fsPromise';
import {getComponentDefinitionFromAst} from '..';
import {parseCode} from '../lib/uiComponentAst';
import nuclideUri from 'nuclide-commons/nuclideUri';

/**
 * This is a convenience script to look at the ComponentDefinition instances for
 * components in a given folder.
 */
(async () => {
  if (process.argv.length !== 3) {
    console.log('Must specify a path.');
    return;
  }

  const components = await fsPromise.glob(
    nuclideUri.join(process.argv[2], '**', '*.react.js'),
  );

  components.forEach(async path => {
    const ast = await parseCode(await fsPromise.readFile(path, 'utf8'));
    if (ast == null) {
      return;
    }

    const definition = getComponentDefinitionFromAst(path, ast);
    console.log(`${nuclideUri.basename(path)}:`);
    if (definition == null) {
      console.log('Could not get component definition from', path);
      return;
    }
    console.log(definition.name);
    if (definition.leadingComment != null) {
      console.log(definition.leadingComment.replace('\n', '<br>'));
    }
    console.log('Required Props:', definition.requiredProps);
    console.log('Default Props:', definition.defaultProps);
    console.log();
  });
})();
