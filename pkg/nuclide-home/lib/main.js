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

/* global localStorage */
import type {HomeFragments} from './types';

import createUtmUrl from './createUtmUrl';
import featureConfig from 'nuclide-commons-atom/feature-config';
import nuclideUri from 'nuclide-commons/nuclideUri';
import fsPromise from 'nuclide-commons/fsPromise';
import {getRuntimeInformation} from '../../commons-node/runtime-info';
import {getAtomNuclideDir} from '../../commons-node/system-info';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {viewableFromReactElement} from '../../commons-atom/viewableFromReactElement';
import HomePaneItem, {WORKSPACE_VIEW_URI} from './HomePaneItem';
import Immutable from 'immutable';
import createPackage from 'nuclide-commons-atom/createPackage';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
import * as React from 'react';
import {BehaviorSubject} from 'rxjs';
import {shell} from 'electron';

class Activation {
  // A stream of all of the fragments. This is essentially the state of our panel.
  _allHomeFragmentsStream: BehaviorSubject<
    Immutable.Set<HomeFragments>,
  > = new BehaviorSubject(Immutable.Set());
  _subscriptions: UniversalDisposable;

  constructor(state: ?Object) {
    this._subscriptions = this._registerCommandAndOpener();
    this._considerDisplayingHome();
    const runtimeInfo = getRuntimeInformation();
    if (
      !runtimeInfo.isDevelopment &&
      featureConfig.get('nuclide-home.showChangelogs')
    ) {
      const key = `nuclide-home.changelog-shown-${runtimeInfo.nuclideVersion}`;
      // Only display the changelog if this is the first time loading this version.
      // Note that displaying the Home page blocks the changelog for the version:
      // the intention here is to avoid showing the changelog for new users.
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, 'true');
        if (!featureConfig.get('nuclide-home.showHome')) {
          this._displayChangelog();
        }
      }
    }
    this._subscriptions.add(
      // eslint-disable-next-line rulesdir/atom-apis
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

  _considerDisplayingHome() {
    const showHome = featureConfig.get('nuclide-home.showHome');
    // flowlint-next-line sketchy-null-mixed:off
    if (showHome) {
      // eslint-disable-next-line rulesdir/atom-apis
      atom.workspace.open(WORKSPACE_VIEW_URI, {searchAllPanes: true});
    }
  }

  async _displayChangelog() {
    const markdownPreviewPkg = atom.packages.getLoadedPackage(
      'markdown-preview',
    );
    if (markdownPreviewPkg != null) {
      await atom.packages.activatePackage('markdown-preview');
      const fbChangelogPath = nuclideUri.join(
        getAtomNuclideDir(),
        'fb-CHANGELOG.md',
      );
      const osChangelogPath = nuclideUri.join(
        getAtomNuclideDir(),
        'CHANGELOG.md',
      );
      const fbChangeLogExists = await fsPromise.exists(fbChangelogPath);
      const changelogPath = fbChangeLogExists
        ? fbChangelogPath
        : osChangelogPath;
      // eslint-disable-next-line rulesdir/atom-apis
      await atom.workspace.open(
        encodeURI(`markdown-preview://${changelogPath}`),
      );
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
