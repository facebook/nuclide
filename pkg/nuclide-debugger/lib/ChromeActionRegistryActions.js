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

/**
 * A map to specific, un-changeable chrome protocol actions understood by
 * `WebInspector.ActionRegistry`, taken from  VendorLib/devtools/front_end/sources/module.json
 */
const ChromeActionRegistryActions = Object.freeze({
  PAUSE: 'debugger.toggle-pause',
  STEP_OVER: 'debugger.step-over',
  STEP_INTO: 'debugger.step-into',
  STEP_OUT: 'debugger.step-out',
  RUN: 'debugger.run-snippet',
});

export default ChromeActionRegistryActions;
