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

import type {HomeFragments} from './types';

import createUtmUrl from './createUtmUrl';
import featureConfig from 'nuclide-commons-atom/feature-config';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {viewableFromReactElement} from '../../commons-atom/viewableFromReactElement';
import HomePaneItem, {WORKSPACE_VIEW_URI} from './HomePaneItem';
import * as Immutable from 'immutable';
import createPackage from 'nuclide-commons-atom/createPackage';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
import * as React from 'react';
import {BehaviorSubject} from 'rxjs';
import {shell} from 'electron';
import passesGK from 'nuclide-commons/passesGK';

const SHOW_NUCLIDE_ONBOARDING_GATEKEEPER = 'nuclide_onboarding';

class Activation {
  // A stream of all of the fragments. This is essentially the state of our panel.
  _allHomeFragmentsStream: BehaviorSubject<
    Immutable.Set<HomeFragments>,
  > = new BehaviorSubject(Immutable.Set());

  _subscriptions: UniversalDisposable;

  constructor(state: ?Object) {
    this._subscriptions = this._registerCommandAndOpener();
    this._considerDisplayingHome();
    this._subscriptions.add(
      // eslint-disable-next-line nuclide-internal/atom-apis
      atom.commands.add('atom-workspace', 'nuclide-home:open-docs', e => {
        const url = createUtmUrl('https://nuclide.io/docs', 'help');
        shell.openExternal(url);
      }),
    );
  }

  setHomeFragments(homeFragments: HomeFragments): UniversalDisposable {
    this._allHomeFragmentsStream.next(
      this._allHomeFragmentsStream.getValue().add(homeFragments),
    );
    return new UniversalDisposable(() => {
      this._allHomeFragmentsStream.next(
        this._allHomeFragmentsStream.getValue().remove(homeFragments),
      );
    });
  }

  dispose(): void {
    this._allHomeFragmentsStream.next(Immutable.Set());
    this._subscriptions.dispose();
  }

  async _considerDisplayingHome() {
    const showHome =
      featureConfig.get('nuclide-home.showHome') &&
      (await !passesGK(SHOW_NUCLIDE_ONBOARDING_GATEKEEPER));

    // flowlint-next-line sketchy-null-mixed:off
    if (showHome) {
      // eslint-disable-next-line nuclide-internal/atom-apis
      atom.workspace.open(WORKSPACE_VIEW_URI, {searchAllPanes: true});
    }
  }

  _registerCommandAndOpener(): UniversalDisposable {
    return new UniversalDisposable(
      atom.workspace.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return viewableFromReactElement(
            <HomePaneItem
              allHomeFragmentsStream={this._allHomeFragmentsStream}
            />,
          );
        }
      }),
      () => destroyItemWhere(item => item instanceof HomePaneItem),
      atom.commands.add('atom-workspace', 'nuclide-home:toggle', () => {
        atom.workspace.toggle(WORKSPACE_VIEW_URI);
      }),
      atom.commands.add('atom-workspace', 'nuclide-docs:open', () => {
        shell.openExternal('https://nuclide.io/');
      }),
    );
  }
}

createPackage(module.exports, Activation);
