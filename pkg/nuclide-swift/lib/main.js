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

import type {TaskRunnerServiceApi} from '../../nuclide-task-runner/lib/types';
import type {SwiftPMTaskRunner as SwiftPMTaskRunnerType} from './taskrunner/SwiftPMTaskRunner';
import type {SwiftPMTaskRunnerStoreState} from './taskrunner/SwiftPMTaskRunnerStoreState';

import invariant from 'assert';
import {SwiftPMTaskRunner} from './taskrunner/SwiftPMTaskRunner';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

let _disposables: ?UniversalDisposable = null;
let _taskRunner: ?SwiftPMTaskRunnerType = null;
let _initialState: ?Object = null;

export function activate(rawState: ?Object): void {
  invariant(_disposables == null);
  _initialState = rawState;
  _disposables = new UniversalDisposable(
    () => {
      _taskRunner = null;
    },
    () => {
      _initialState = null;
    },
  );
}

export function deactivate(): void {
  invariant(_disposables != null);
  _disposables.dispose();
  _disposables = null;
}

export function consumeTaskRunnerServiceApi(
  serviceApi: TaskRunnerServiceApi,
): void {
  invariant(_disposables != null);
  _disposables.add(serviceApi.register(_getTaskRunner()));
}

export function serialize(): ?SwiftPMTaskRunnerStoreState {
  if (_taskRunner != null) {
    return _taskRunner.serialize();
  }
}

export function createAutocompleteProvider(): atom$AutocompleteProvider {
  return {
    selector: '.source.swift',
    inclusionPriority: 1,
    disableForSelector: '.source.swift .comment',
    getSuggestions(
      request: atom$AutocompleteRequest,
    ): Promise<?Array<atom$AutocompleteSuggestion>> {
      return _getTaskRunner()
        .getAutocompletionProvider()
        .getAutocompleteSuggestions(request);
    },
  };
}

function _getTaskRunner(): SwiftPMTaskRunner {
  if (_taskRunner == null) {
    invariant(_disposables != null);
    _taskRunner = new SwiftPMTaskRunner(_initialState);
    _disposables.add(_taskRunner);
  }
  return _taskRunner;
}
