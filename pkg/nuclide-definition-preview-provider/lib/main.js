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

import type {Definition, DefinitionPreviewProvider} from 'atom-ide-ui';

import {getDefinitionPreviewServiceByNuclideUri} from '../../nuclide-remote-connection';

export function provideDefinitionPreview(): DefinitionPreviewProvider {
  return {
    async getDefinitionPreview(definition: Definition): Promise<string> {
      const service = await getDefinitionPreviewServiceByNuclideUri(
        definition.path,
      );

      return service.getDefinitionPreview(definition);
    },
  };
}
