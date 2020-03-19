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

import type {Observable} from 'rxjs';
import type {List} from 'immutable';
import type {IExpression} from '../../..';

// The type of the object passed to your package's `consumeConsole()` function.
export type ConsoleService = (options: SourceInfo) => ConsoleApi;

// The console API. An object of this type is returned when you invoke the function provided by the
// console service.
export type ConsoleApi = {
  // The primary means of interacting with the console.
  // TODO: Update these to be `(object: any, ...objects: Array<any>): void` to allow for logging objects.
  log(object: string, _: void): ?RecordToken,
  error(object: string, _: void): ?RecordToken,
  warn(object: string, _: void): ?RecordToken,
  info(object: string, _: void): ?RecordToken,
  success(object: string, _: void): ?RecordToken,

  // A generic API for sending a message of any level (log, error, etc.).
  append(message: Message): ?RecordToken,

  // Dispose of the console. Invoke this when your package is disabled.
  dispose(): void,

  // Set the status of the source. See "Stoppable Sources" below.
  setStatus(status: ConsoleSourceStatus): void,
};

// A type representing the possible values for the `console.setStatus()` API.
export type ConsoleSourceStatus = 'starting' | 'running' | 'stopped';

// The shape of the argument to the `ConsoleService` function.
export type SourceInfo = {
  id: string, // A unique identifier representing this source.
  name: string, // A human-readable name for the source. This will be used in the UI.

  // `start()` and `stop()` functions can optionally be provided. See [User-Controllable Console
  // Sources](https://github.com/facebook-atom/atom-ide-ui/blob/master/docs/console.md#user-controllable-console-sources)
  // for more information.
  start?: () => void,
  stop?: () => void,
};

// Message levels. For use with the `console.append()` API.
export type Level =
  | 'info'
  | 'log'
  | 'warning'
  | 'error'
  | 'debug'
  | 'success'
  | Color;
type Color =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'violet'
  | 'rainbow';

export type Severity = 'info' | 'warning' | 'error';

// A message object, for use with the `console.append()` API.
export type Message = {|
  text: string,
  level: Level,
  format?: MessageFormat,

  // Internally used properties. These are subject to change so don't use em!
  expressions?: Array<IExpression>,
  tags?: ?Array<string>,
  kind?: ?MessageKind,
  scopeName?: ?string,
  incomplete?: boolean,
|};

//
//
// The following types aren't part of public API but rather are used within the package.
//
//

type MessageKind = 'message' | 'request' | 'response';
type MessageFormat = 'ansi';

// A normalized type used internally to represent all possible kinds of messages. Responses and
// Messages are transformed into these.
// Make sure shouldAccumulateRecordCount in Reducers.js is up to date with these fields
export type Record = {|
  messageId?: string,
  text: string,
  level: Level,
  incomplete: boolean,
  format?: MessageFormat,
  tags?: ?Array<string>,
  repeatCount: number,

  kind: MessageKind,
  sourceId: string,
  sourceName: string,
  scopeName: ?string,
  expressions?: Array<IExpression>,
  timestamp: Date,

  executor?: Executor,
|};

export type RecordToken = {|
  +getCurrentText: () => string,
  +getCurrentLevel: () => Level,
  setLevel: (level: Level) => RecordToken,
  appendText: (text: string) => RecordToken,
  setComplete: () => void,
|};

export type AppState = {|
  createPasteFunction: ?CreatePasteFunction,
  currentExecutorId: ?string,
  executors: Map<string, Executor>,
  maxMessageCount: number,
  // We use Immutable for the records list so that adding an item is O(1). However, rendering the
  // items after the addition is O(n), so it's important that we schedule and throttle our renders
  // or we'll lose the benefit of an O(1) insertion.
  records: List<Record>,
  incompleteRecords: List<Record>,
  history: Array<string>,
  providers: Map<string, SourceInfo>,
  providerStatuses: Map<string, ConsoleSourceStatus>,
  fontSize?: number,
  watchEditor?: ?atom$AutocompleteWatchEditor,
|};

export type Source = {
  id: string,
  name: string,
  status: ConsoleSourceStatus,
  start?: () => void,
  stop?: () => void,
};

type BasicRecordProvider = {
  records: Observable<Record>,
  id: string,
};

type ControllableRecordProviderProps = {
  observeStatus(callback: (status: ConsoleSourceStatus) => mixed): IDisposable,
  start(): void,
  stop(): void,
};

type ControllableRecordProvider = BasicRecordProvider &
  ControllableRecordProviderProps;

export type RecordProvider = BasicRecordProvider | ControllableRecordProvider;

// Serialized state specific to each instance of the console view. For example, each instance has
// its own, distinct filter, so that's here. They don't, however, have distinct records, so they
// aren't.
export type ConsolePersistedState = {|
  deserializer: 'nuclide.Console',
  filterText?: string,
  enableRegExpFilter?: boolean,
  unselectedSourceIds?: Array<string>,
  unselectedSeverities?: Array<Severity>,
|};

export type Executor = {
  id: string,
  name: string,
  send(message: string): void,
  output: Observable<Message>,
  scopeName: () => string,
  provideSymbols?: (prefix: string) => Array<string>,
  onDidChangeScopeName?: (callback: () => void) => IDisposable,
};

export type RegisterExecutorFunction = (executor: Executor) => IDisposable;

export type PasteOptions = {
  language?: ?string,
  title?: ?string,
};

export type CreatePasteFunction = (
  message: string,
  options: PasteOptions,
  source: string,
) => Promise<string>;

export type Store = {
  getState(): AppState,
  dispatch(action: Action): void,
  subscribe(() => void): () => void,
};

export type Action =
  | {
      type: 'CLEAR_RECORDS',
    }
  | {
      type: 'REGISTER_EXECUTOR',
      payload: {
        executor: Executor,
      },
    }
  | {
      type: 'EXECUTE',
      payload: {
        code: string,
      },
    }
  | {
      type: 'RECORD_RECEIVED',
      payload: {
        record: Record,
      },
    }
  | {
      type: 'RECORD_UPDATED',
      payload: {
        messageId: string,
        appendText: ?string,
        overrideLevel: ?Level,
        setComplete: boolean,
      },
    }
  | {
      type: 'REGISTER_RECORD_PROVIDER',
      payload: {
        recordProvider: RecordProvider,
      },
    }
  | {
      type: 'REGISTER_SOURCE',
      payload: {
        source: SourceInfo,
      },
    }
  | {
      type: 'REMOVE_SOURCE',
      payload: {
        sourceId: string,
      },
    }
  | {
      type: 'SELECT_EXECUTOR',
      payload: {
        executorId: string,
      },
    }
  | {
      type: 'SET_CREATE_PASTE_FUNCTION',
      payload: {
        createPasteFunction: ?CreatePasteFunction,
      },
    }
  | {
      type: 'SET_WATCH_EDITOR_FUNCTION',
      payload: {
        watchEditor: ?atom$AutocompleteWatchEditor,
      },
    }
  | {
      type: 'SET_MAX_MESSAGE_COUNT',
      payload: {
        maxMessageCount: number,
      },
    }
  | {
      type: 'UPDATE_STATUS',
      payload: {
        providerId: string,
        status: ConsoleSourceStatus,
      },
    }
  | {
      type: 'SET_FONT_SIZE',
      payload: {
        fontSize: number,
      },
    };
