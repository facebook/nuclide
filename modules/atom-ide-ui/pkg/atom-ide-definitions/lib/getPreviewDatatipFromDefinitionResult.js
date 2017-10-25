/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import analytics from 'nuclide-commons-atom/analytics';
import {getDefinitionPreview as getLocalFileDefinitionPreview} from 'nuclide-commons/symbol-definition-preview';

import React from 'react';
import type {Datatip} from '../../atom-ide-datatip/lib/types';

import type {Definition, DefinitionPreviewProvider} from './types';

export default (async function getPreviewDatatipFromDefinition(
  range: atom$Range,
  definitions: Array<Definition>,
  definitionPreviewProvider: ?DefinitionPreviewProvider,
  grammar: atom$Grammar,
): Promise<?Datatip> {
  if (definitions.length === 1) {
    const definition = definitions[0];
    // Some providers (e.g. Flow) return negative positions.
    if (definition.position.row < 0) {
      return null;
    }

    const definitionPreview = await getPreview(
      definition,
      definitionPreviewProvider,
    );

    if (definitionPreview == null) {
      return null;
    }

    // if mimetype is image return image component with base-64 encoded
    //  image contents, otherwise use markedStrings
    if (definitionPreview.mime.startsWith('image/')) {
      return {
        component: () => (
          <img
            src={`data:${definitionPreview.mime};${definitionPreview.encoding},${definitionPreview.contents}`}
          />
        ),
        range,
      };
    }
    return {
      markedStrings: [
        {
          type: 'snippet',
          value: definitionPreview.contents,
          grammar,
        },
      ],
      range,
    };
  }

  return {
    markedStrings: [
      {
        type: 'markdown',
        value: `${definitions.length} definitions found. Click to jump.`,
        grammar,
      },
    ],
    range,
  };
});

async function getPreview(
  definition: Definition,
  definitionPreviewProvider: ?DefinitionPreviewProvider,
) {
  let getDefinitionPreviewFn;
  if (definitionPreviewProvider == null) {
    getDefinitionPreviewFn = getLocalFileDefinitionPreview;
  } else {
    getDefinitionPreviewFn = definitionPreviewProvider.getDefinitionPreview.bind(
      definitionPreviewProvider,
    );
  }

  return analytics.trackTiming('hyperclickPreview.getDefinitionPreview', () =>
    getDefinitionPreviewFn(definition),
  );
}
