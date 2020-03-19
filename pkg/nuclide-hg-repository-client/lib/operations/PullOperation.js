/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {HgOperation, ReportedOptimisticState} from '../HgOperation';
import type {RevisionTree} from '../revisionTree/RevisionTree';

import {Observable} from 'rxjs';

export class HgPullOperation implements HgOperation {
  name = 'pull';

  getArgs() {
    return ['pull'];
  }

  getEquivalentCommand() {
    return this.getArgs().join(' ');
  }

  getCommandDocumentation() {
    return null;
  }

  makeOptimisticStateApplier(
    treeObservable: Observable<Array<RevisionTree>>,
  ): Observable<?ReportedOptimisticState> {
    // We don't want to wait for an updated revisionlist because pull won't always trigger one.
    // Instead, consider this command complete as soon as it finishes running
    return Observable.of({showFullscreenSpinner: true});
  }
}
