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

import type {Datatip} from '../../atom-ide-datatip/lib/types';
import type {
  DiagnosticUpdater,
  DiagnosticMessage,
} from '../../atom-ide-diagnostics/lib/types';

import invariant from 'assert';
import * as React from 'react';
import {Observable} from 'rxjs';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {DiagnosticsPopup} from './ui/DiagnosticsPopup';

const gotoLine = (file: string, line: number) => goToLocation(file, {line});

export function makeDatatipComponent(
  messages: Array<DiagnosticMessage>,
  diagnosticUpdater: DiagnosticUpdater,
  props?: $Shape<React.ElementProps<typeof DiagnosticsPopup>>,
): React.ComponentType<mixed> {
  return bindObservableAsProps(
    Observable.combineLatest(
      observableFromSubscribeFunction(cb =>
        diagnosticUpdater.observeCodeActionsForMessage(cb),
      ),
      observableFromSubscribeFunction(cb =>
        diagnosticUpdater.observeDescriptions(cb),
      ),
    ).map(([codeActionsForMessage, descriptions]) => {
      return {
        messages,
        codeActionsForMessage,
        descriptions,
        ...props,
      };
    }),
    DiagnosticsPopup,
  );
}

export default (async function getDiagnosticDatatip(
  editor: TextEditor,
  position: atom$Point,
  messagesAtPosition: Array<DiagnosticMessage>,
  diagnosticUpdater: DiagnosticUpdater,
): Promise<?Datatip> {
  let range = null;
  for (const message of messagesAtPosition) {
    if (message.range != null) {
      range = range == null ? message.range : message.range.union(range);
    }
  }
  diagnosticUpdater.fetchCodeActions(editor, messagesAtPosition);
  diagnosticUpdater.fetchDescriptions(messagesAtPosition);
  invariant(range != null);
  return {
    component: makeDatatipComponent(messagesAtPosition, diagnosticUpdater, {
      fixer: message => diagnosticUpdater.applyFix(message),
      goToLocation: gotoLine,
    }),
    pinnable: false,
    range,
  };
});
