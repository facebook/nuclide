/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {
  LaunchRequestArguments,
  AttachRequestArguments,
} from 'vscode-debugprotocol';
import type {Arguments} from '../DebuggerAdapterFactory';
import type {CustomArgumentType} from '../VSPOptionsParser';
import type {DebugAdapter} from '../DebugAdapter';
import type {VsAdapterType} from 'nuclide-debugger-common';

import {getAdapterPackageRoot} from 'nuclide-debugger-common/debugger-registry';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {VsAdapterTypes} from 'nuclide-debugger-common/constants';
import VSPOptionsParser from '../VSPOptionsParser';

export default class PythonDebugAdapter implements DebugAdapter {
  key: VsAdapterType = VsAdapterTypes.PYTHON;
  type: string = 'python';
  excludedOptions: Set<string> = new Set([
    'args',
    'console',
    'diagnosticLogging',
    'externalConsole',
    'noDebug',
    'outputCapture',
    'program',
    'restart',
    'trace',
    'verboseDiagnosticLogging',
  ]);

  extensions: Set<string> = new Set(['.py']);
  customArguments: Map<string, CustomArgumentType> = new Map();
  muteOutputCategories: Set<string> = new Set(['telemetry', 'stderr']);
  replThread: ?number = null;
  supportsCodeBlocks: boolean = false;

  _includedOptions: Set<string> = new Set(['address', 'port']);

  parseArguments(args: Arguments): Map<string, any> {
    const action = args.attach ? 'attach' : 'launch';
    const root = getAdapterPackageRoot(this.key);
    const parser = new VSPOptionsParser(root);
    const commandLineArgs = parser.parseCommandLine(
      this.type,
      action,
      this.excludedOptions,
      this._includedOptions,
      this.customArguments,
    );

    if (action === 'launch') {
      const launchArgs = args._;
      const program = launchArgs[0];

      commandLineArgs.set('args', launchArgs.splice(1));
      commandLineArgs.set('program', nuclideUri.resolve(program));
      commandLineArgs.set('noDebug', false);
      commandLineArgs.set('cwd', nuclideUri.resolve('.'));
    }

    return commandLineArgs;
  }

  transformLaunchArguments(
    args: ?LaunchRequestArguments,
  ): LaunchRequestArguments {
    return args || {};
  }

  transformAttachArguments(
    args: ?AttachRequestArguments,
  ): AttachRequestArguments {
    return args || {};
  }

  transformExpression(exp: string, isCodeBlock: boolean): string {
    return exp;
  }

  async canDebugFile(file: string): Promise<boolean> {
    // no special cases, just use file extension
    return false;
  }
}
