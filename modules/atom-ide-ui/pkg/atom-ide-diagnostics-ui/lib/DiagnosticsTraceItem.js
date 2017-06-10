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

import type {Trace} from '../../atom-ide-diagnostics/lib/rpc-types';

import React from 'react';
import {DiagnosticsMessageText} from './DiagnosticsMessageText';

type DiagnosticsTraceItemProps = {
  trace: Trace,
  goToLocation: (path: string, line: number) => mixed,
};

// TODO move LESS styles to nuclide-ui
export const DiagnosticsTraceItem = (props: DiagnosticsTraceItemProps) => {
  const {trace, goToLocation} = props;
  let locSpan = null;
  // Local variable so that the type refinement holds in the onClick handler.
  const path = trace.filePath;
  if (path) {
    const [, relativePath] = atom.project.relativizePath(path);
    let locString = relativePath;
    if (trace.range) {
      locString += `:${trace.range.start.row + 1}`;
    }
    const onClick = (event: SyntheticMouseEvent) => {
      event.stopPropagation();
      goToLocation(path, Math.max(trace.range ? trace.range.start.row : 0, 0));
    };
    locSpan = <span>: <a href="#" onClick={onClick}>{locString}</a></span>;
  }
  return (
    <div>
      <DiagnosticsMessageText message={trace} />
      {locSpan}
    </div>
  );
};
