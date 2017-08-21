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

import type {RefactorProvider} from '..';
import type {Observable} from 'rxjs';

import type {Store} from './types';

import {createStore, applyMiddleware} from 'redux';
import {Subject} from 'rxjs';

import type ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import {
  createEpicMiddleware,
  combineEpics,
} from 'nuclide-commons/redux-observable';
import {getLogger} from 'log4js';

import refactorReducers from './refactorReducers';
import {getEpics} from './refactorEpics';

// TODO create this lazily
const errors: Subject<mixed> = new Subject();

function handleError(error: mixed): void {
  getLogger('nuclide-refactorizer').error(
    'Uncaught exception in refactoring:',
    error,
  );
  errors.next(error);
}

export function getStore(providers: ProviderRegistry<RefactorProvider>): Store {
  const rootEpic = (actions, store) => {
    return combineEpics(...getEpics(providers))(
      actions,
      store,
    ).catch((error, stream) => {
      handleError(error);
      return stream;
    });
  };
  const exceptionHandler = store => next => action => {
    try {
      return next(action);
    } catch (e) {
      handleError(e);
    }
  };
  return createStore(
    refactorReducers,
    applyMiddleware(exceptionHandler, createEpicMiddleware(rootEpic)),
  );
}

export function getErrors(): Observable<mixed> {
  return errors.asObservable();
}
