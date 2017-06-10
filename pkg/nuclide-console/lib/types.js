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

import type {Observable} from 'rxjs';
import type {Level as TaskLevelType} from 'nuclide-commons/process';
import type {
  EvaluationResult,
  ExpansionResult,
} from '../../nuclide-debugger/lib/types';

export type Level = TaskLevelType | Color;
type Color =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'violet'
  | 'rainbow';

type MessageKind = 'message' | 'request' | 'response';

// A regular message, emitted by output providers.
export type Message = {
  text: string,
  level: Level,
  data?: EvaluationResult,
  tags?: ?Array<string>,
  kind?: ?MessageKind,
  scopeName?: ?string,
};

// A normalized type used internally to represent all possible kinds of messages. Responses and
// Messages are transformed into these.
export type Record = {
  text: string,
  level: Level,
  data?: EvaluationResult,
  tags?: ?Array<string>,

  kind: MessageKind,
  sourceId: string,
  scopeName: ?string,
  data: ?EvaluationResult,
  timestamp: Date,
};

export type AppState = {
  currentExecutorId: ?string,
  executors: Map<string, Executor>,
  maxMessageCount: number,
  records: Array<Record>,
  history: Array<string>,
  providers: Map<string, SourceInfo>,
  providerStatuses: Map<string, OutputProviderStatus>,
};

// A special type used internally by the ConsoleContainer component to represent
// each record that is displayed with its height. This is stored at the component
// level since the expansion state of any record (which affects its height) is
// unique to each Console pane (whereas the records themselves are shared between
// all Console panes). The height is needed for partial rendering.
export type DisplayableRecord = {
  id: number,
  record: Record,
  height: number,
  expansionStateId: Object,
};

export type RecordHeightChangeHandler = (
  recordId: number,
  newHeight: number,
  callback: () => void,
) => void;

export type OutputProviderStatus = 'starting' | 'running' | 'stopped';

type BasicOutputProvider = {
  messages: Observable<Message>,
  // The source can't be part of the message because we want to be able to populate a filter menu
  // before we even have any messages.
  id: string,
  getProperties?: (objectId: string) => Observable<?ExpansionResult>,
};

type ControllableOutputProviderProps = {
  observeStatus(callback: (status: OutputProviderStatus) => mixed): IDisposable,
  start(): void,
  stop(): void,
};

type ControllableOutputProvider = BasicOutputProvider &
  ControllableOutputProviderProps;

export type OutputProvider = BasicOutputProvider | ControllableOutputProvider;

type BasicRecordProvider = {
  records: Observable<Record>,
  id: string,
  getProperties?: (objectId: string) => Observable<?ExpansionResult>,
};

type ControllableRecordProvider = BasicRecordProvider &
  ControllableOutputProviderProps;

export type RecordProvider = BasicRecordProvider | ControllableRecordProvider;

export type Source = {
  id: string,
  name: string,
  status: OutputProviderStatus,
  start?: () => void,
  stop?: () => void,
};

export type OutputService = {
  registerOutputProvider(outputProvider: OutputProvider): IDisposable,
};

export type SourceInfo = {
  id: string,
  name: string,
  start?: () => void,
  stop?: () => void,
};
export type ConsoleService = (options: SourceInfo) => ConsoleApi;
export type ConsoleApi = {
  setStatus(status: OutputProviderStatus): void,
  append(message: Message): void,
  dispose(): void,

  // TODO: Update these to be (object: any, ...objects: Array<any>): void.
  log(object: string, _: void): void,
  error(object: string, _: void): void,
  warn(object: string, _: void): void,
  info(object: string, _: void): void,
};

export type ConsolePersistedState = {
  deserializer: 'nuclide.ConsoleContainer',
  filterText?: string,
  enableRegExpFilter?: boolean,
  unselectedSourceIds?: Array<string>,
};

export type Executor = {
  id: string,
  name: string,
  send(message: string): void,
  output: Observable<Message | {result?: EvaluationResult}>,
  scopeName?: string,
  getProperties?: (objectId: string) => Observable<?ExpansionResult>,
};

export type RegisterExecutorFunction = (executor: Executor) => IDisposable;

export type Store = {
  getState(): AppState,
  dispatch(action: Action): void,
};

export type ClearRecordsAction = {
  type: 'CLEAR_RECORDS',
};

export type RegisterExecutorAction = {
  type: 'REGISTER_EXECUTOR',
  payload: {
    executor: Executor,
  },
};

export type ExecuteAction = {
  type: 'EXECUTE',
  payload: {
    code: string,
  },
};

export type RecordReceivedAction = {
  type: 'RECORD_RECEIVED',
  payload: {
    record: Record,
  },
};

export type RegisterRecordProviderAction = {
  type: 'REGISTER_RECORD_PROVIDER',
  payload: {
    recordProvider: RecordProvider,
  },
};

export type RegisterSourceAction = {
  type: 'REGISTER_SOURCE',
  payload: {
    source: SourceInfo,
  },
};

export type RemoveSourceAction = {
  type: 'REMOVE_SOURCE',
  payload: {
    sourceId: string,
  },
};

export type SelectExecutorAction = {
  type: 'SELECT_EXECUTOR',
  payload: {
    executorId: string,
  },
};

export type SetMaxMessageCountAction = {
  type: 'SET_MAX_MESSAGE_COUNT',
  payload: {
    maxMessageCount: number,
  },
};

export type UpdateStatusAction = {
  type: 'UPDATE_STATUS',
  payload: {
    providerId: string,
    status: OutputProviderStatus,
  },
};

export type Action =
  | ClearRecordsAction
  | ExecuteAction
  | RecordReceivedAction
  | RegisterExecutorAction
  | RegisterRecordProviderAction
  | RegisterSourceAction
  | RemoveSourceAction
  | SelectExecutorAction
  | SetMaxMessageCountAction
  | UpdateStatusAction;
