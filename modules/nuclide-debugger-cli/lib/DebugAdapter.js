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
import type {Arguments} from './DebuggerAdapterFactory';
import type {CustomArgumentType} from './VSPOptionsParser';
import type {VsAdapterType} from 'nuclide-debugger-common';

// Describes options for hosting a particular VSP adapter via the cli
export interface DebugAdapter {
  // the adapter's key in Nuclide's set of adapters
  +key: VsAdapterType;
  // the debugger's type in the adapter package.json
  +type: string;
  // options which the adapter supports but which could be harmful if used from
  // the command line
  +excludedOptions: Set<string>;
  // The set of file extensions which the debugger should map to this adapter
  +extensions: Set<string>;
  // Arguments which require special parsing by the adapter implementation
  +customArguments: Map<string, CustomArgumentType>;
  // output event categories which should not be echoed to the console
  +muteOutputCategories: Set<string>;
  // if not null, a thread that the adapter has dedicated to repl requests
  // if set, this thread should respond to debugger requests even if running,
  // and the debugger will not generate a pause event in order to execute them.
  +replThread: ?number;
  // whether or not the adapter handles interpreted code blocks via evaluation
  +supportsCodeBlocks: boolean;
  transformLaunchArguments(
    args: ?LaunchRequestArguments,
  ): LaunchRequestArguments;
  transformAttachArguments(
    args: ?AttachRequestArguments,
  ): AttachRequestArguments;
  // if the adapter overrides this, it can use checks other than just the file
  // extension to see if it can debug the file (such as the shebang line or
  // actual file contents. the adapter will be considered viable if canDebugFile
  // returns true OR the extension is in the `extensions` set.
  canDebugFile(file: string): Promise<boolean>;
  parseArguments(args: Arguments): Map<string, any>;
  // transform an argument for evaluation. this is applied for printing
  // expressions but not for code entry.
  transformExpression(exp: string, isCodeBlock: boolean): string;
}
