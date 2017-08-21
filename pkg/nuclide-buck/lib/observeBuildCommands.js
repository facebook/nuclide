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

import type {AppState, Store} from './types';

import {Observable} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {track} from '../../nuclide-analytics';
import {getBuckServiceByNuclideUri} from '../../nuclide-remote-connection';
import * as Actions from './redux/Actions';

const CHECK_INTERVAL = 30000;
const CONFIG_KEY = 'nuclide-buck.suggestTaskRunner';

export default function observeBuildCommands(store: Store): IDisposable {
  return new UniversalDisposable(
    // $FlowFixMe: type symbol-observable
    Observable.from(store)
      .switchMap((state: AppState) => {
        const {buckRoot} = state;
        if (buckRoot == null) {
          return Observable.empty();
        }
        // Check the most recent Buck log at a fixed interval to check for
        // Buck command invocations.
        // We can't use Watchman because these logs are typically ignored.
        const buckService = getBuckServiceByNuclideUri(buckRoot);
        return Observable.interval(CHECK_INTERVAL).switchMap(() => {
          return (
            Observable.fromPromise(buckService.getLastCommandInfo(buckRoot, 1))
              // Ignore errors.
              .catch(() => Observable.of(null))
              .switchMap(commandInfo => {
                if (commandInfo == null) {
                  return Observable.empty();
                }
                const {timestamp, command, args} = commandInfo;
                // Only report simple single-target build commands for now.
                if (
                  Date.now() - timestamp > CHECK_INTERVAL ||
                  command !== 'build' ||
                  args.length !== 1 ||
                  args[0].startsWith('-')
                ) {
                  return Observable.empty();
                }
                return Observable.of(commandInfo);
              })
          );
        });
      })
      // Only show this once per session.
      .take(1)
      .takeUntil(
        featureConfig.observeAsStream(CONFIG_KEY).filter(x => x === false),
      )
      .subscribe(({args}) => {
        function dismiss() {
          notification.dismiss();
          featureConfig.set(CONFIG_KEY, false);
        }
        track('buck-prompt.shown', {buildTarget: args[0]});
        const notification = atom.notifications.addInfo(
          `You recently ran \`buck build ${args.join(
            ' ',
          )}\` from the command line.<br />` +
            'Would you like to try building from the Task Runner?',
          {
            dismissable: true,
            icon: 'nuclicon-buck',
            buttons: [
              {
                text: 'Try it!',
                className: 'icon icon-triangle-right',
                onDidClick: () => {
                  track('buck-prompt.clicked', {buildTarget: args[0]});
                  store.dispatch(Actions.setBuildTarget(args[0]));
                  atom.commands.dispatch(
                    atom.views.getView(atom.workspace),
                    'nuclide-task-runner:toggle-buck-toolbar',
                    {visible: true},
                  );
                  dismiss();
                },
              },
              {
                text: "Don't show me this again",
                onDidClick: () => {
                  track('buck-prompt.dismissed');
                  dismiss();
                },
              },
            ],
          },
        );
      }),
  );
}
