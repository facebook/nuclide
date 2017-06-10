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

import {PanelLocation} from '../lib/PanelLocation';
import invariant from 'assert';

describe('PanelLocation', () => {
  it('serializes the state', () => {
    const location = new PanelLocation('top');
    location._handlePanelResize(720);
    location.setState({active: true});
    const serialized = location.serialize();
    invariant(serialized != null);
    expect(serialized.data.size).toBe(720);
    expect(serialized.data.active).toBe(true);
    expect(serialized.data.paneContainer).toBeDefined();
  });

  it('restores the serialized state', () => {
    const serialized = {
      deserializer: 'PanelLocation',
      data: {
        paneContainer: null,
        size: 720,
        active: true,
      },
    };
    const location = new PanelLocation('top', serialized);
    expect(location._size).toBe(720);
    expect(location.state.active).toBe(true);
  });

  it('restores legacy serialized state', () => {
    const serialized = {
      deserializer: 'PanelLocation',
      data: {
        paneContainer: null,
        size: 720,
        visible: true,
      },
    };
    const location = new PanelLocation('top', serialized);
    expect(location.state.active).toBe(true);
  });
});
