/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {DiagnosticTrace} from '../../../atom-ide-diagnostics/lib/types';

import * as React from 'react';
import {DiagnosticsMessageText} from './DiagnosticsMessageText';

type DiagnosticsTraceItemProps = {
  trace: DiagnosticTrace,
  goToLocation: (path: string, line: number) => mixed,
};

// TODO move LESS styles to nuclide-ui
export const DiagnosticsTraceItem = (props: DiagnosticsTraceItemProps) => {
  const {trace, goToLocation} = props;
  let locSpan = null;
  // Local variable so that the type refinement holds in the onClick handler.
  const path = trace.filePath;
  // flowlint-next-line sketchy-null-string:off
  if (path) {
    const [, relativePath] = atom.project.relativizePath(path);
    let locString = relativePath;
    if (trace.range) {
      locString += `:${trace.range.start.row + 1}`;
    }
    const onClick = (event: SyntheticMouseEvent<>) => {
      event.stopPropagation();
      goToLocation(path, Math.max(trace.range ? trace.range.start.row : 0, 0));
    };
    locSpan = (
      <span>
        :{' '}
        <a href="#" onClick={onClick}>
          {locString}
        </a>
      </span>
    );
  }
  return (
    <div>
      <DiagnosticsMessageText message={trace} />
      {locSpan}
    </div>
  );
};
