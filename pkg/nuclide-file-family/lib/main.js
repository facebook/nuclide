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

// $FlowFB
import type {RegisterProvider} from '../../fb-dash/lib/types';
import type CwdApi from '../../nuclide-current-working-directory/lib/CwdApi';
import type {Provider} from '../../nuclide-quick-open/lib/types';
import type {FileFamilyProvider} from './types';
import type {RelatedFileResult} from './FileFamilyQuickOpenProvider';

import createPackage from 'nuclide-commons-atom/createPackage';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {BehaviorSubject} from 'rxjs';
import FileFamilyAggregator from './FileFamilyAggregator';
import FileFamilyDashProvider from './FileFamilyDashProvider';
import FileFamilyQuickOpenProvider from './FileFamilyQuickOpenProvider';
import {getAlternatesFromGraph} from './FileFamilyUtils';

class Activation {
  _disposables: UniversalDisposable;
  _aggregator: ?FileFamilyAggregator;
  _aggregators: BehaviorSubject<?FileFamilyAggregator> = new BehaviorSubject();
  _cwds: BehaviorSubject<?CwdApi> = new BehaviorSubject();
  _providers: BehaviorSubject<Set<FileFamilyProvider>> = new BehaviorSubject(
    new Set(),
  );

  activate() {
    this._disposables = new UniversalDisposable(
      atom.commands.add('atom-workspace', {
        'file:open-alternate': this._toggleAlternate,
      }),
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  registerQuickOpenProvider(): Provider<RelatedFileResult> {
    return new FileFamilyQuickOpenProvider(this._aggregators, this._cwds);
  }

  provideFileFamilyService(): FileFamilyProvider {
    if (this._aggregator) {
      return this._aggregator;
    }

    const aggregator = new FileFamilyAggregator(this._providers.asObservable());
    this._aggregator = aggregator;
    this._aggregators.next(aggregator);
    this._disposables.add(aggregator);

    return aggregator;
  }

  consumeFileFamilyProvider(provider: ?FileFamilyProvider): IDisposable {
    if (provider == null) {
      return new UniversalDisposable();
    }

    const newProviders = new Set(this._providers.getValue());
    newProviders.add(provider);
    this._providers.next(newProviders);

    return new UniversalDisposable(() => {
      const withoutProvider = new Set(this._providers.getValue());
      withoutProvider.delete(provider);
      this._providers.next(withoutProvider);
    });
  }

  consumeCwd(service: CwdApi) {
    this._cwds.next(service);
  }

  consumeDash(registerProvider: RegisterProvider): ?IDisposable {
    const registerDisposable = registerProvider(
      new FileFamilyDashProvider(this._aggregators, this._cwds),
    );
    this._disposables.add(registerDisposable);
  }

  _toggleAlternate = async () => {
    const provider = this._aggregator;
    if (provider == null) {
      return;
    }

    const activeEditor = atom.workspace.getActiveTextEditor();
    if (activeEditor == null) {
      return;
    }

    const activeUri = activeEditor.getURI();
    if (activeUri == null) {
      return;
    }

    const graph = await provider.getRelatedFiles(activeUri);
    const alternates = getAlternatesFromGraph(graph, activeUri);
    if (alternates.length === 0) {
      atom.notifications.addError(
        'Unable to locate any alternates for this file',
      );
    } else if (alternates.length === 1) {
      await goToLocation(alternates[0]);
    } else {
      atom.commands.dispatch(
        atom.workspace.getElement(),
        'file-family-dash-provider:toggle-provider',
      );
    }
  };
}

createPackage(module.exports, Activation);
