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

/* eslint-env browser */

import type {IExpression} from '../../../..';
import type {
  ConsolePersistedState,
  ConsoleSourceStatus,
  Record,
  Source,
  Store,
  SourceInfo,
  Severity,
  Level,
  AppState,
} from '../types';
import type {CreatePasteFunction} from '../types';
import type {RegExpFilterChange} from 'nuclide-commons-ui/RegExpFilter';

import observePaneItemVisibility from 'nuclide-commons-atom/observePaneItemVisibility';
import {setDifference, areSetsEqual} from 'nuclide-commons/collection';
import Model from 'nuclide-commons/Model';
import shallowEqual from 'shallowequal';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import memoizeUntilChanged from 'nuclide-commons/memoizeUntilChanged';
import {toggle} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {nextAnimationFrame} from 'nuclide-commons/observable';
import observableFromReduxStore from 'nuclide-commons/observableFromReduxStore';
import {getFilterPattern} from 'nuclide-commons-ui/RegExpFilter';
import * as Actions from '../redux/Actions';
import * as Selectors from '../redux/Selectors';
import ConsoleView from './ConsoleView';
import {List} from 'immutable';
import * as React from 'react';
import {Observable, ReplaySubject} from 'rxjs';

type Options = {|
  store: Store,
  initialFilterText?: string,
  initialEnableRegExpFilter?: boolean,
  initialUnselectedSourceIds?: Array<string>,
  initialUnselectedSeverities?: Set<Severity>,
|};

//
// State unique to this particular Console instance
//
type State = {
  filterText: string,
  enableRegExpFilter: boolean,
  unselectedSourceIds: Array<string>,
  selectedSeverities: Set<Severity>,
};

type BoundActionCreators = {
  execute: (code: string) => void,
  selectExecutor: (executorId: string) => void,
  clearRecords: () => void,
};

// Other Nuclide packages (which cannot import this) depend on this URI. If this
// needs to be changed, grep for CONSOLE_VIEW_URI and ensure that the URIs match.
export const WORKSPACE_VIEW_URI = 'atom://nuclide/console';

const ERROR_TRANSCRIBING_MESSAGE =
  "// Nuclide couldn't find the right text to display";

const ALL_SEVERITIES = new Set(['error', 'warning', 'info']);

/**
 * An Atom "view model" for the console. This object is responsible for creating a stateful view
 * (via `getElement()`). That view is bound to both global state (from the store) and view-specific
 * state (from this instance's `_model`).
 */
export class Console {
  _actionCreators: BoundActionCreators;

  _titleChanges: Observable<string>;
  _model: Model<State>;
  _store: Store;
  _element: ?HTMLElement;
  _destroyed: ReplaySubject<void>;

  constructor(options: Options) {
    const {
      store,
      initialFilterText,
      initialEnableRegExpFilter,
      initialUnselectedSourceIds,
      initialUnselectedSeverities,
    } = options;
    this._model = new Model({
      displayableRecords: [],
      filterText: initialFilterText == null ? '' : initialFilterText,
      enableRegExpFilter: Boolean(initialEnableRegExpFilter),
      unselectedSourceIds:
        initialUnselectedSourceIds == null ? [] : initialUnselectedSourceIds,
      selectedSeverities:
        initialUnselectedSeverities == null
          ? ALL_SEVERITIES
          : setDifference(ALL_SEVERITIES, initialUnselectedSeverities),
    });

    this._store = store;
    this._destroyed = new ReplaySubject(1);

    this._titleChanges = Observable.combineLatest(
      this._model.toObservable(),
      observableFromReduxStore(store),
    )
      .takeUntil(this._destroyed)
      .map(() => this.getTitle())
      .distinctUntilChanged()
      .share();
  }

  getIconName(): string {
    return 'nuclicon-console';
  }

  // Get the pane item's title. If there's only one source selected, we'll use that to make a more
  // descriptive title.
  getTitle(): string {
    const enabledProviderCount = this._store.getState().providers.size;
    const {unselectedSourceIds} = this._model.state;

    // Calling `_getSources()` is (currently) expensive because it needs to search all the records
    // for sources that have been disabled but still have records. We try to avoid calling it if we
    // already know that there's more than one selected source.
    if (enabledProviderCount - unselectedSourceIds.length > 1) {
      return 'Console';
    }

    // If there's only one source selected, use its name in the tab title.
    const sources = this._getSources();
    if (sources.length - unselectedSourceIds.length === 1) {
      const selectedSource = sources.find(
        source => unselectedSourceIds.indexOf(source.id) === -1,
      );
      if (selectedSource) {
        return `Console: ${selectedSource.name}`;
      }
    }

    return 'Console';
  }

  getDefaultLocation(): string {
    return 'bottom';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  onDidChangeTitle(callback: (title: string) => mixed): IDisposable {
    return new UniversalDisposable(this._titleChanges.subscribe(callback));
  }

  _getSources(): Array<Source> {
    const {
      providers,
      providerStatuses,
      records,
      incompleteRecords,
    } = this._store.getState();
    return this._getSourcesMemoized({
      providers,
      providerStatuses,
      records,
      incompleteRecords,
    });
  }

  // Memoize `getSources()`. Unfortunately, since we look for unrepresented sources in the record
  // list, this still needs to be called whenever the records change.
  // TODO: Consider removing records when their source is removed. This will likely require adding
  // the ability to enable and disable sources so, for example, when the debugger is no longer
  // active, it still remains in the source list.
  // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
  _getSourcesMemoized = memoizeUntilChanged(
    getSources,
    opts => opts,
    (a, b) => shallowEqual(a, b),
  );

  destroy(): void {
    this._destroyed.next();
  }

  copy(): Console {
    return new Console({
      store: this._store,
      initialFilterText: this._model.state.filterText,
      initialEnableRegExpFilter: this._model.state.enableRegExpFilter,
      initialUnselectedSourceIds: this._model.state.unselectedSourceIds,
      initialUnselectedSeverities: setDifference(
        ALL_SEVERITIES,
        this._model.state.selectedSeverities,
      ),
    });
  }

  _getBoundActionCreators(): BoundActionCreators {
    if (this._actionCreators == null) {
      this._actionCreators = {
        execute: code => {
          this._store.dispatch(Actions.execute(code));
        },
        selectExecutor: executorId => {
          this._store.dispatch(Actions.selectExecutor(executorId));
        },
        clearRecords: () => {
          this._store.dispatch(Actions.clearRecords());
        },
      };
    }
    return this._actionCreators;
  }

  _resetAllFilters = (): void => {
    this._selectSources(this._getSources().map(s => s.id));
    this._model.setState({filterText: ''});
  };

  _createPaste = async (): Promise<void> => {
    const displayableRecords = Selectors.getAllRecords(
      this._store.getState(),
    ).toArray();
    const createPasteImpl = this._store.getState().createPasteFunction;
    if (createPasteImpl == null) {
      return;
    }
    return createPaste(createPasteImpl, displayableRecords);
  };

  _getFilterInfo(): {
    invalid: boolean,
    selectedSourceIds: Array<string>,
    filteredRecords: Array<Record>,
    selectedSeverities: Set<Severity>,
  } {
    const {pattern, invalid} = getFilterPattern(
      this._model.state.filterText,
      this._model.state.enableRegExpFilter,
    );
    const sources = this._getSources();
    const selectedSourceIds = sources
      .map(source => source.id)
      .filter(
        sourceId =>
          this._model.state.unselectedSourceIds.indexOf(sourceId) === -1,
      );

    const {selectedSeverities} = this._model.state;
    const filteredRecords = filterRecords(
      Selectors.getAllRecords(this._store.getState()).toArray(),
      selectedSourceIds,
      selectedSeverities,
      pattern,
      sources.length !== selectedSourceIds.length,
    );

    return {
      invalid,
      selectedSourceIds,
      selectedSeverities,
      filteredRecords,
    };
  }

  getElement(): HTMLElement {
    if (this._element != null) {
      return this._element;
    }

    const actionCreators = this._getBoundActionCreators();
    const globalStates: Observable<AppState> = observableFromReduxStore(
      this._store,
    );

    const props = Observable.combineLatest(
      this._model.toObservable(),
      globalStates,
    )
      // Don't re-render when the console isn't visible.
      .let(toggle(observePaneItemVisibility(this)))
      .audit(() => nextAnimationFrame)
      .map(([localState, globalState]) => {
        const {
          invalid,
          selectedSourceIds,
          selectedSeverities,
          filteredRecords,
        } = this._getFilterInfo();

        const currentExecutorId = Selectors.getCurrentExecutorId(globalState);
        const currentExecutor =
          currentExecutorId != null
            ? globalState.executors.get(currentExecutorId)
            : null;

        return {
          invalidFilterInput: invalid,
          execute: actionCreators.execute,
          selectExecutor: actionCreators.selectExecutor,
          clearRecords: actionCreators.clearRecords,
          createPaste:
            globalState.createPasteFunction == null ? null : this._createPaste,
          watchEditor: globalState.watchEditor,
          currentExecutor,
          unselectedSourceIds: localState.unselectedSourceIds,
          filterText: localState.filterText,
          enableRegExpFilter: localState.enableRegExpFilter,
          records: filteredRecords,
          filteredRecordCount:
            Selectors.getAllRecords(globalState).size - filteredRecords.length,
          history: globalState.history,
          sources: this._getSources(),
          selectedSourceIds,
          selectSources: this._selectSources,
          executors: globalState.executors,
          getProvider: id => globalState.providers.get(id),
          updateFilter: this._updateFilter,
          resetAllFilters: this._resetAllFilters,
          fontSize: globalState.fontSize,
          selectedSeverities,
          toggleSeverity: this._toggleSeverity,
        };
      });

    const StatefulConsoleView = bindObservableAsProps(props, ConsoleView);
    return (this._element = renderReactRoot(<StatefulConsoleView />));
  }

  serialize(): ConsolePersistedState {
    const {
      filterText,
      enableRegExpFilter,
      unselectedSourceIds,
      selectedSeverities,
    } = this._model.state;
    return {
      deserializer: 'nuclide.Console',
      filterText,
      enableRegExpFilter,
      unselectedSourceIds,
      unselectedSeverities: [
        ...setDifference(ALL_SEVERITIES, selectedSeverities),
      ],
    };
  }

  _selectSources = (selectedSourceIds: Array<string>): void => {
    const sourceIds = this._getSources().map(source => source.id);
    const unselectedSourceIds = sourceIds.filter(
      sourceId => selectedSourceIds.indexOf(sourceId) === -1,
    );
    this._model.setState({unselectedSourceIds});
  };

  /** Unselects the sources from the given IDs */
  unselectSources(ids: Array<string>): void {
    const newIds = ids.filter(
      id => !this._model.state.unselectedSourceIds.includes(id),
    );
    this._model.setState({
      unselectedSourceIds: this._model.state.unselectedSourceIds.concat(newIds),
    });
  }

  _updateFilter = (change: RegExpFilterChange): void => {
    const {text, isRegExp} = change;
    this._model.setState({
      filterText: text,
      enableRegExpFilter: isRegExp,
    });
  };

  _toggleSeverity = (severity: Severity): void => {
    const {selectedSeverities} = this._model.state;
    const nextSelectedSeverities = new Set(selectedSeverities);
    if (nextSelectedSeverities.has(severity)) {
      nextSelectedSeverities.delete(severity);
    } else {
      nextSelectedSeverities.add(severity);
    }
    this._model.setState({selectedSeverities: nextSelectedSeverities});
  };
}

function getSources(options: {
  records: List<Record>,
  providers: Map<string, SourceInfo>,
  providerStatuses: Map<string, ConsoleSourceStatus>,
}): Array<Source> {
  const {providers, providerStatuses, records} = options;

  // Convert the providers to a map of sources.
  const mapOfSources = new Map(
    Array.from(providers.entries()).map(([k, provider]) => {
      const source = {
        id: provider.id,
        name: provider.name,
        status: providerStatuses.get(provider.id) || 'stopped',
        start:
          typeof provider.start === 'function' ? provider.start : undefined,
        stop: typeof provider.stop === 'function' ? provider.stop : undefined,
      };
      return [k, source];
    }),
  );

  // Some providers may have been unregistered, but still have records. Add sources for them too.
  // TODO: Iterating over all the records to get this every time we get a new record is inefficient.
  records.forEach((record, i) => {
    if (!mapOfSources.has(record.sourceId)) {
      mapOfSources.set(record.sourceId, {
        id: record.sourceId,
        name: record.sourceId,
        status: 'stopped',
        start: undefined,
        stop: undefined,
      });
    }
  });

  return Array.from(mapOfSources.values());
}

function filterRecords(
  records: Array<Record>,
  selectedSourceIds: Array<string>,
  selectedSeverities: Set<Severity>,
  filterPattern: ?RegExp,
  filterSources: boolean,
): Array<Record> {
  if (
    !filterSources &&
    filterPattern == null &&
    areSetsEqual(ALL_SEVERITIES, selectedSeverities)
  ) {
    return records;
  }

  return records.filter(record => {
    // Only filter regular messages
    if (record.kind !== 'message') {
      return true;
    }

    if (!selectedSeverities.has(levelToSeverity(record.level))) {
      return false;
    }

    const sourceMatches = selectedSourceIds.indexOf(record.sourceId) !== -1;
    return (
      sourceMatches &&
      (filterPattern == null || filterPattern.test(record.text))
    );
  });
}

async function serializeRecordObject(
  visited: Set<string>,
  expression: IExpression,
  text: string,
  level: number,
): Promise<string> {
  const getText = exp => {
    let indent = '';
    for (let i = 0; i < level; i++) {
      indent += '\t';
    }
    return indent + exp.getValue();
  };

  if (!expression.hasChildren()) {
    // Leaf node.
    return text + getText(expression);
  }

  const id = expression.getId();
  if (visited.has(id)) {
    // Guard against cycles.
    return text;
  }

  visited.add(id);

  const children = await expression.getChildren();
  const serializedProps = children.map(childProp => {
    return serializeRecordObject(visited, childProp, '', level + 1);
  });
  return (
    getText(expression) + '\n' + (await Promise.all(serializedProps)).join('\n')
  );
}

async function createPaste(
  createPasteImpl: CreatePasteFunction,
  records: Array<Record>,
): Promise<void> {
  const linePromises = records
    .filter(
      record =>
        record.kind === 'message' ||
        record.kind === 'request' ||
        record.kind === 'response',
    )
    .map(async record => {
      const level =
        record.level != null ? record.level.toString().toUpperCase() : 'LOG';
      const timestamp = record.timestamp.toLocaleString();
      let text = record.text || ERROR_TRANSCRIBING_MESSAGE;

      if (
        record.kind === 'response' &&
        record.expressions != null &&
        record.expressions.length > 0
      ) {
        text = '';
        for (const expression of record.expressions) {
          // If the record has a data object, and the object has an ID,
          // recursively expand the nodes of the object and serialize it
          // for the paste.
          // eslint-disable-next-line no-await-in-loop
          text += await serializeRecordObject(new Set(), expression, '', 0);
        }
      }

      return `[${level}][${record.sourceId}][${timestamp}]\t ${text}`;
    });

  const lines = (await Promise.all(linePromises)).join('\n');

  if (lines === '') {
    // Can't create an empty paste!
    atom.notifications.addWarning(
      'There is nothing in your console to Paste! Check your console filters and try again.',
    );
    return;
  }

  atom.notifications.addInfo('Creating Paste...');

  try {
    const uri = await createPasteImpl(
      lines,
      {
        title: 'Nuclide Console Paste',
      },
      'console paste',
    );
    atom.notifications.addSuccess(`Created Paste at ${uri}`);
  } catch (error) {
    if (error.stdout == null) {
      atom.notifications.addError(
        `Failed to create paste: ${String(error.message || error)}`,
      );
      return;
    }
    const errorMessages = error.stdout
      .trim()
      .split('\n')
      .map(JSON.parse)
      .map(e => e.message);
    atom.notifications.addError('Failed to create paste', {
      detail: errorMessages.join('\n'),
      dismissable: true,
    });
  }
}

function levelToSeverity(level: Level): Severity {
  switch (level) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'log':
    case 'info':
    case 'debug':
    case 'success':
      return 'info';
    default:
      // All the colors are "info"
      return 'info';
  }
}
