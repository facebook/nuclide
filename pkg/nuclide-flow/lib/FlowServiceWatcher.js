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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {FlowLanguageServiceType} from '../../nuclide-flow-rpc';

import {Observable, Subscription} from 'rxjs';

import featureConfig from 'nuclide-commons-atom/feature-config';
import {ConnectionCache} from '../../nuclide-remote-connection';

const WARN_NOT_INSTALLED_CONFIG = 'nuclide-flow.warnOnNotInstalled';

export class FlowServiceWatcher {
  _subscription: Subscription;

  constructor(connectionCache: ConnectionCache<FlowLanguageServiceType>) {
    this._subscription = new Subscription();

    const flowLanguageServices: Observable<
      FlowLanguageServiceType,
    > = connectionCache
      .observeValues()
      .mergeMap(p => Observable.fromPromise(p));
    const serverStatusUpdates = flowLanguageServices
      .mergeMap(ls => {
        return ls.getServerStatusUpdates().refCount();
      })
      .share();

    this._subscription.add(
      serverStatusUpdates
        .filter(({status}) => status === 'failed')
        .subscribe(({pathToRoot}) => {
          handleFailure(pathToRoot);
        }),
    );

    this._subscription.add(
      serverStatusUpdates
        .filter(({status}) => status === 'not installed')
        .take(1)
        .subscribe(({pathToRoot}) => {
          handleNotInstalled(pathToRoot);
        }),
    );
  }

  dispose(): void {
    this._subscription.unsubscribe();
  }
}

async function handleFailure(pathToRoot: NuclideUri): Promise<void> {
  const buttons = [
    {
      className: 'icon icon-zap',
      onDidClick() {
        atom.commands.dispatch(
          atom.views.getView(atom.workspace),
          'nuclide-flow:restart-flow-server',
        );
        if (buttons.length > 1) {
          this.classList.add('disabled');
        } else {
          notification.dismiss();
        }
      },
      text: 'Restart Flow Server',
    },
  ];
  try {
    // $FlowFB
    const reportButton = await require('./fb-report-crash').getButton();
    if (reportButton != null) {
      buttons.push(reportButton);
    }
  } catch (e) {}
  const notification = atom.notifications.addError(
    `Flow has failed in <code>${pathToRoot}</code>`,
    {
      description: `Flow features will be disabled for the remainder of this
        Nuclide session. You may re-enable them by clicking below or by running
        the "Restart Flow Server" command from the command palette later.`,
      dismissable: true,
      buttons,
    },
  );
}

function handleNotInstalled(pathToRoot: NuclideUri): void {
  if (!featureConfig.get(WARN_NOT_INSTALLED_CONFIG)) {
    return;
  }
  const title = `Flow was not found when attempting to start it in '${pathToRoot}'.`;
  const description =
    'If you do not want to use Flow, you can ignore this message.<br/><br/>' +
    'You can download it from <a href="http://flowtype.org/">flowtype.org</a>. ' +
    'Make sure it is installed and on your PATH. ' +
    'If this is a remote repository make sure it is available on the remote machine.<br/><br/>' +
    'You will not see this message again until you restart Nuclide';
  const notification = atom.notifications.addInfo(title, {
    description,
    dismissable: true,
    buttons: [
      {
        className: 'icon icon-x',
        onDidClick() {
          notification.dismiss();
          featureConfig.set(WARN_NOT_INSTALLED_CONFIG, false);
        },
        text: 'Do not show again (can be reverted in settings)',
      },
    ],
  });
}
