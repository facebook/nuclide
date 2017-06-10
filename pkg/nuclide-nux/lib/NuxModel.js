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

export type NuxViewModel = {
  content: string,
  selector: ?string,
  selectorFunction?: () => HTMLElement,
  position: 'top' | 'bottom' | 'left' | 'right' | 'auto',
  completionPredicate?: () => boolean,
};

export type NuxTourModel = {
  id: number,
  name: string,
  nuxList: Array<NuxViewModel>,
  trigger?: NuxTriggerModel,
  /**
   * An optional gatekeeper ID to to pass in with this NUX.
   * If omitted, the NUX will always show.
   * If supplied, the NUX will show iff both this and the global `nuclide_all_nuxes` pass.
   */
  gatekeeperID?: string,
  /**
    * WARNING:  DO NOT COMMIT with this value set to true! The flow type ensures
    * that an error will occur if you do so. Setting to true will always show the
    * NUX every session, which is useful during development.
    */
  developmentMode?: false,
};

export type NuxTriggerModel = {
  triggerType: NuxTriggerType,
  triggerCallback: (editor: atom$TextEditor) => boolean,
};

// Add more trigger types here as use cases are developed
export type NuxTriggerType = 'editor';

// Represents the 'viewed' state of a NUX
export type NuxStateModel = {
  id: number,
  name: string,
  completed: boolean,
};
