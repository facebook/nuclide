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

import type {Store} from './types';
import * as Selectors from './redux/Selectors';
import * as Actions from './redux/Actions';
// $FlowFixMe(>=0.53.0) Flow suppress
import type React from 'react';

import * as Immutable from 'immutable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export default class ProjectSelectionManager {
  _store: Store;

  constructor(store: Store) {
    this._store = store;
  }

  addExtraContent(content: React.Element<any>): IDisposable {
    this._store.dispatch(Actions.addExtraProjectSelectionContent(content));
    return new UniversalDisposable(() =>
      this._store.dispatch(Actions.removeExtraProjectSelectionContent(content)),
    );
  }

  getExtraContent(): Immutable.List<React.Element<any>> {
    return Selectors.getExtraProjectSelectionContent(this._store.getState());
  }
}
