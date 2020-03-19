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

export type {
  BusySignalOptions,
  BusySignalService,
} from './pkg/atom-ide-busy-signal/lib/types';

export type {
  CodeAction,
  CodeActionProvider,
} from './pkg/atom-ide-code-actions/lib/types';

export type {
  CodeFormatProvider,
  RangeCodeFormatProvider,
  FileCodeFormatProvider,
  OnTypeCodeFormatProvider,
  OnSaveCodeFormatProvider,
} from './pkg/atom-ide-code-format/lib/types';

export type {
  CodeHighlightProvider,
} from './pkg/atom-ide-code-highlight/lib/types';

export type {
  Datatip,
  DatatipProvider,
  DatatipService,
  MarkedString,
  ModifierDatatipProvider,
  ModifierKey,
} from './pkg/atom-ide-datatip/lib/types';

export type {
  Definition,
  DefinitionProvider,
  DefinitionPreviewProvider,
  DefinitionQueryResult,
} from './pkg/atom-ide-definitions/lib/types';

export type {
  CallbackDiagnosticProvider,
  DiagnosticFix,
  DiagnosticInvalidationCallback,
  DiagnosticInvalidationMessage,
  DiagnosticMessage,
  DiagnosticMessages,
  DiagnosticMessageKind,
  DiagnosticMessageType,
  DiagnosticProvider,
  DiagnosticProviderUpdate,
  DiagnosticTrace,
  DiagnosticUpdater,
  DiagnosticUpdateCallback,
  IndieLinterDelegate,
  LinterMessage,
  LinterMessageV1,
  LinterMessageV2,
  LinterProvider,
  LinterTrace,
  ObservableDiagnosticProvider,
  RegisterIndieLinter,
} from './pkg/atom-ide-diagnostics/lib/types';

export type {
  FindReferencesProvider,
  FindReferencesReturn,
  Reference,
} from './pkg/atom-ide-find-references/lib/types';

export type {
  AvailableRefactoring,
  RefactorResponse,
  RefactorProvider,
  RefactorRequest,
  RenameReturn,
  RenameData,
  RenameError,
} from './pkg/atom-ide-refactor/lib/types';

export type {
  Outline,
  OutlineProvider,
  OutlineTree,
  ResultsStreamProvider,
} from './pkg/atom-ide-outline-view/lib/types';

export type {
  Signature,
  SignatureHelp,
  SignatureHelpProvider,
  SignatureHelpRegistry,
  SignatureParameter,
} from './pkg/atom-ide-signature-help/lib/types';

export type {
  HyperclickProvider,
  HyperclickSuggestion,
} from './pkg/hyperclick/lib/types';

export type {
  ConsoleService,
  ConsoleApi,
  Level as ConsoleLevel,
  Message as ConsoleMessage,
  SourceInfo as ConsoleSourceInfo,
  ConsoleSourceStatus,
} from './pkg/atom-ide-console/lib/types';

// Deprecated console types. Exported only for legacy users.
export type {RegisterExecutorFunction} from './pkg/atom-ide-console/lib/types';

export type {IExpression, IVariable} from './pkg/atom-ide-debugger/lib/types';
export {
  ExpressionTreeComponent,
} from './pkg/atom-ide-debugger/lib/ui/ExpressionTreeComponent';
export {
  RemoteDebuggerService as DebuggerService,
} from './pkg/atom-ide-debugger/lib/types';

export type {
  TerminalInfo,
  TerminalInstance,
  TerminalApi,
} from './pkg/atom-ide-terminal/lib/types';

export type {
  Command as TerminalCommand,
} from './pkg/atom-ide-terminal/lib/pty-service/rpc-types';
