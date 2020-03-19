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

import type {Store} from '../types';

import {combineEpicsFromImports} from 'nuclide-commons/epicHelpers';
import {createStore as _createStore} from 'redux';
import {createEpicMiddleware} from 'nuclide-commons/redux-observable';
import {applyMiddleware} from 'redux';
import * as Epics from './Epics';
import Reducers from './Reducers';

export default function createStore(): Store {
  const rootEpic = (actions, store) =>
    combineEpicsFromImports(Epics, 'nuclide-file-tree')(actions, store);

  return _createStore(
    Reducers,
    null,
    applyMiddleware(createEpicMiddleware(rootEpic)),
  );
}
