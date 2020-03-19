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
import type {Action} from './redux/Actions';
import type {TaskSettings, UnsanitizedTaskSettings} from './types';

import {arrayEqual} from 'nuclide-commons/collection';
import {Observable} from 'rxjs';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {track} from 'nuclide-analytics';
import {getBuckServiceByNuclideUri} from '../../nuclide-remote-connection';
import * as Actions from './redux/Actions';

const CHECK_INTERVAL = 30000;
const CONFIG_KEY = 'nuclide-buck.suggestTaskRunner';
const WATCH_CONFIG_ARGS_KEY = 'nuclide-buck.watchConfigArgs';

type WatchConfigSetting = 'Prompt' | 'Always' | 'Never';

function readWatchConfig(): WatchConfigSetting {
  // $FlowIgnore: type is guarded by write function and package.json.
  const watch = (featureConfig.get(WATCH_CONFIG_ARGS_KEY): any);
  return watch != null ? watch : 'Prompt';
}

function writeWatchConfig(setting: WatchConfigSetting): void {
  track('buck-watch-config.set', {setting});
  featureConfig.set(WATCH_CONFIG_ARGS_KEY, setting);
}

// Return whether the user elects to automatically update the compilation
// database arguments with detected config settings.
function promptConfigChange(
  prevConfigArgs: ?Array<string>,
  nextConfigArgs: Array<string>,
): Promise<boolean> {
  const watchSetting = readWatchConfig();
  if (
    nextConfigArgs.findIndex(arg => arg.startsWith('client.id')) !== -1 ||
    arrayEqual(prevConfigArgs || [], nextConfigArgs) ||
    watchSetting === 'Never'
  ) {
    return Promise.resolve(false);
  } else if (watchSetting === 'Always') {
    return Promise.resolve(true);
  } else {
    return new Promise((resolve, reject) => {
      const notification = atom.notifications.addInfo(
        `You recently ran Buck with config flags \`[${nextConfigArgs.join(
          ' ',
        )}]\` from the command line.<br />` +
          'Would you like Nuclide to automatically use the most recent config' +
          ' for compilation database calls for language services? (to avoid resetting the Buck cache)',
        {
          dismissable: true,
          icon: 'nuclicon-buck',
          buttons: [
            {
              text: 'Yes',
              className: 'icon icon-triangle-right',
              onDidClick: () => {
                writeWatchConfig('Always');
                resolve(true);
                notification.dismiss();
              },
            },
            {
              text: 'No',
              onDidClick: () => {
                writeWatchConfig('Never');
                resolve(false);
                notification.dismiss();
              },
            },
          ],
        },
      );
      notification.onDidDismiss(() => resolve(false));
    });
  }
}

function promptTaskRunner(args: Array<string>): Promise<boolean> {
  return new Promise((resolve, reject) => {
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
              atom.commands.dispatch(
                atom.views.getView(atom.workspace),
                'nuclide-task-runner:toggle-buck-toolbar',
                {visible: true},
              );
              resolve(true);
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
    notification.onDidDismiss(() => resolve(false));
  });
}

export function observeBuildCommands(
  buckRoot: NuclideUri,
  currentTaskSettings: () => TaskSettings,
  currentUnsanitizedTaskSettings: () => UnsanitizedTaskSettings,
): Observable<Action> {
  // Check the most recent Buck log at a fixed interval to check for
  // Buck command invocations.
  // We can't use Watchman because these logs are typically ignored.
  const buckService = getBuckServiceByNuclideUri(buckRoot);
  return Observable.interval(CHECK_INTERVAL)
    .startWith(0)
    .switchMap(() => {
      return (
        Observable.fromPromise(buckService.getLastBuildCommandInfo(buckRoot))
          // Ignore errors.
          .catch(() => Observable.of(null))
          .filter(Boolean)
          .filter(({timestamp}) => Date.now() - timestamp <= CHECK_INTERVAL)
      );
    })
    .switchMap(({args}) => {
      if (
        featureConfig.get(CONFIG_KEY) !== true ||
        args.length !== 1 ||
        args[0].startsWith('-') ||
        args[0].startsWith('@')
      ) {
        const configFlag = '--config';
        // Attempt to extract only @args files and --config arguments from the command.
        const configArgs = args.filter(
          (arg, index) =>
            arg.startsWith('@mode/') ||
            arg.startsWith(configFlag) ||
            args[index - 1] === configFlag,
        );
        const currentSettings = currentTaskSettings();
        const currentUnsanitizedSettings = currentUnsanitizedTaskSettings();
        return Observable.fromPromise(
          promptConfigChange(currentSettings.compileDbArguments, configArgs),
        )
          .filter(shouldUpdate => shouldUpdate === true)
          .map(() =>
            Actions.setTaskSettings(
              {
                ...currentSettings,
                compileDbArguments: configArgs,
              },
              currentUnsanitizedSettings,
            ),
          );
      }
      return Observable.fromPromise(promptTaskRunner(args))
        .filter(answer => answer === true)
        .map(() => Actions.setBuildTarget(args[0]));
    });
}
