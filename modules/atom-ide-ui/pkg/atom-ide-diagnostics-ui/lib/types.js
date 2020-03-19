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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  DiagnosticMessage,
  DiagnosticMessageKind,
  DiagnosticMessageType,
  UiConfig,
} from '../../atom-ide-diagnostics/lib/types';

// We group diagnostics based on kind and severity.
export type DiagnosticGroup =
  | 'errors'
  | 'warnings'
  | 'info'
  | 'review'
  | 'action';

// State that's shared between every diagnostics panel instance.
export type GlobalViewState = {
  diagnostics: Array<DiagnosticMessage>,
  pathToActiveTextEditor: ?NuclideUri,
  filterByActiveTextEditor: boolean,
  onFilterByActiveTextEditorChange: (isChecked: boolean) => mixed,
  showDirectoryColumn: boolean,
  autoVisibility: boolean,
  showTraces: boolean,
  onShowTracesChange: (isChecked: boolean) => mixed,
  supportedMessageKinds: Set<DiagnosticMessageKind>,
  uiConfig: UiConfig,
};

export type Location = {|
  fullPath: NuclideUri,
  locationInFile: ?{|
    basename: string,
    line: number,
  |},
|};

export type DisplayDiagnostic = {
  +classification: {
    kind: DiagnosticMessageKind,
    severity: DiagnosticMessageType,
  },
  +providerName: string,
  +description: {
    showTraces: boolean,
    diagnostic: DiagnosticMessage,
    text: string,
    isPlainText: boolean,
  },
  +dir: string,
  +location: ?Location,
  +line: ?number,
};
