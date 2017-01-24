/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */


import type {WorkspaceViewsService} from '../../nuclide-workspace-views/lib/types';
import type {HomeFragments} from './types';

import createUtmUrl from './createUtmUrl';
import featureConfig from '../../commons-atom/featureConfig';
import UniversalDisposable from '../../commons-node/UniversalDisposable';
import {viewableFromReactElement} from '../../commons-atom/viewableFromReactElement';
import HomePaneItem, {WORKSPACE_VIEW_URI} from './HomePaneItem';
import Immutable from 'immutable';
import {React} from 'react-for-atom';
import {BehaviorSubject} from 'rxjs';
import {shell} from 'electron';

let subscriptions: UniversalDisposable = (null: any);

// A stream of all of the fragments. This is essentially the state of our panel.
const allHomeFragmentsStream: BehaviorSubject<Immutable.Set<HomeFragments>> =
  new BehaviorSubject(Immutable.Set());

export function activate(state: ?Object): void {
  considerDisplayingHome();
  subscriptions = new UniversalDisposable();
  subscriptions.add(
    // eslint-disable-next-line nuclide-internal/atom-apis
    atom.commands.add('atom-workspace', 'nuclide-home:open-docs', e => {
      const url = createUtmUrl('https://nuclide.io/docs', 'help');
      shell.openExternal(url);
    }),
  );
}

export function setHomeFragments(homeFragments: HomeFragments): UniversalDisposable {
  allHomeFragmentsStream.next(allHomeFragmentsStream.getValue().add(homeFragments));
  return new UniversalDisposable(() => {
    allHomeFragmentsStream.next(allHomeFragmentsStream.getValue().remove(homeFragments));
  });
}

function considerDisplayingHome() {
  const showHome = featureConfig.get('nuclide-home.showHome');
  if (showHome) {
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'nuclide-home:toggle',
      {visible: true},
    );
  }
}

export function deactivate(): void {
  allHomeFragmentsStream.next(Immutable.Set());
  subscriptions.dispose();
  subscriptions = (null: any);
}

export function consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
  subscriptions.add(
    api.addOpener(uri => {
      if (uri === WORKSPACE_VIEW_URI) {
        return viewableFromReactElement(
          <HomePaneItem allHomeFragmentsStream={allHomeFragmentsStream} />,
        );
      }
    }),
    () => api.destroyWhere(item => item instanceof HomePaneItem),
    atom.commands.add(
      'atom-workspace',
      'nuclide-home:toggle',
      event => { api.toggle(WORKSPACE_VIEW_URI, (event: any).detail); },
    ),
  );
  considerDisplayingHome();
}
