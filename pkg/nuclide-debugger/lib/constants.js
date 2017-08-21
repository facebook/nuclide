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

export const AnalyticsEvents = Object.freeze({
  DEBUGGER_BREAKPOINT_ADD: 'debugger-breakpoint-add',
  DEBUGGER_BREAKPOINT_DELETE: 'debugger-breakpoint-delete',
  DEBUGGER_BREAKPOINT_DELETE_ALL: 'debugger-breakpoint-delete-all',
  DEBUGGER_BREAKPOINT_TOGGLE: 'debugger-breakpoint-toggle',
  DEBUGGER_BREAKPOINT_TOGGLE_ENABLED: 'debugger-breakpoint-toggle-enabled',
  DEBUGGER_BREAKPOINT_UPDATE_CONDITION: 'debugger-breakpoint-update-condition',
  DEBUGGER_START: 'debugger-start',
  DEBUGGER_START_FAIL: 'debugger-start-fail',
  DEBUGGER_STEP_CONTINUE: 'debugger-step-continue',
  DEBUGGER_STEP_INTO: 'debugger-step-into',
  DEBUGGER_STEP_OUT: 'debugger-step-out',
  DEBUGGER_STEP_OVER: 'debugger-step-over',
  DEBUGGER_STEP_RUN_TO_LOCATION: 'debugger-step-run-to-location',
  DEBUGGER_STEP_PAUSE: 'debugger-step-pause',
  DEBUGGER_STOP: 'debugger-stop',
  DEBUGGER_TOGGLE_ATTACH_DIALOG: 'debugger-toggle-attach-dialog',
  DEBUGGER_TOGGLE_CAUGHT_EXCEPTION: 'debugger-toggle-caught-exception',
  DEBUGGER_TOGGLE_PAUSE_EXCEPTION: 'debugger-toggle-pause-exception',
  DEBUGGER_TOGGLE_SINGLE_THREAD_STEPPING:
    'debugger-toggle-single-thread-stepping',
  DEBUGGER_UI_MOUNTED: 'debugger-ui-mounted',
  DEBUGGER_UI_TOGGLED: 'debugger-ui-toggled',
  DEBUGGER_WATCH_ADD_EXPRESSION: 'debugger-watch-add-expression',
  DEBUGGER_WATCH_REMOVE_EXPRESSION: 'debugger-watch-remove-expression',
  DEBUGGER_WATCH_UPDATE_EXPRESSION: 'debugger-watch-update-expression',
});
