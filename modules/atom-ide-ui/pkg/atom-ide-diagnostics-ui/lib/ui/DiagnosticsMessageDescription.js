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

import * as React from 'react';
import marked from 'marked';
import createDOMPurify from 'dompurify';

const domPurify = createDOMPurify();

type DiagnosticsMessageDescriptionProps = {
  description: ?string,
};

export class DiagnosticsMessageDescription extends React.PureComponent<
  DiagnosticsMessageDescriptionProps,
> {
  render() {
    const {description} = this.props;
    if (description != null) {
      const __html = domPurify.sanitize(marked(description));
      return <div dangerouslySetInnerHTML={{__html}} />;
    }
    return null;
  }
}
