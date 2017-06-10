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
  * When we upstreamed this functionality into Atom, we picked better location names. This
  * translates from our old ones to the new ones.
  */
export default function getNewLocation(location: string): string {
  switch (location) {
    case 'left-panel':
      return 'left';
    case 'right-panel':
      return 'right';
    case 'bottom-panel':
      return 'bottom';
    case 'pane':
      return 'center';
    case 'left':
    case 'right':
    case 'bottom':
    case 'center':
    default:
      return location;
  }
}
