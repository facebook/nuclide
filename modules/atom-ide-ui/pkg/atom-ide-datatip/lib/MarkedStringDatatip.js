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

import type {MarkedString} from './types';

import marked from 'marked';
import * as React from 'react';

import MarkedStringSnippet from './MarkedStringSnippet';

type Props = {
  markedStrings: Array<MarkedString>,
};

export default class MarkedStringDatatip extends React.PureComponent<Props> {
  render(): React.Node {
    const elements = this.props.markedStrings.map((chunk, i) => {
      if (chunk.type === 'markdown') {
        return (
          <div
            className="datatip-marked-container"
            dangerouslySetInnerHTML={{
              __html: marked(chunk.value, {sanitize: true}),
            }}
            key={i}
          />
        );
      } else {
        return <MarkedStringSnippet key={i} {...chunk} />;
      }
    });

    return <div className="datatip-marked">{elements}</div>;
  }
}
