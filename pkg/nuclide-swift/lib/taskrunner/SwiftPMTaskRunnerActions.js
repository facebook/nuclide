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

import type SwiftPMTaskRunnerDispatcher from './SwiftPMTaskRunnerDispatcher';

import {llbuildYamlPath, readCompileCommands} from './LlbuildYamlParser';
import {ActionTypes} from './SwiftPMTaskRunnerDispatcher';

export default class SwiftPMTaskRunnerActions {
  _dispatcher: SwiftPMTaskRunnerDispatcher;

  constructor(dispatcher: SwiftPMTaskRunnerDispatcher) {
    this._dispatcher = dispatcher;
  }

  updateProjectRoot(projectRoot: ?string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_PROJECT_ROOT,
      projectRoot,
    });
  }

  updateSettings(
    configuration: string,
    Xcc: string,
    Xlinker: string,
    Xswiftc: string,
    buildPath: string,
  ): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_SETTINGS,
      configuration,
      Xcc,
      Xlinker,
      Xswiftc,
      buildPath,
    });
  }

  updateCompileCommands(
    chdir: string,
    configuration: string,
    buildPath: string,
  ): void {
    const yamlPath = llbuildYamlPath(chdir, configuration, buildPath);
    let compileCommandsPromise;
    try {
      compileCommandsPromise = readCompileCommands(yamlPath);
    } catch (e) {
      atom.notifications.addError(
        'The YAML produced by the Swift package manager is malformed',
        {
          description:
            `Nuclide could not parse the YAML file at \`${yamlPath}\`. ` +
            'Please file a bug, and include the contents of the file in ' +
            'your report.',
        },
      );
      return;
    }
    compileCommandsPromise.then(compileCommands => {
      this._dispatcher.dispatch({
        actionType: ActionTypes.UPDATE_COMPILE_COMMANDS,
        compileCommands,
      });
    });
  }
}
