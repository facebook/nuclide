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

import PanelRenderer from '../PanelRenderer';
import invariant from 'assert';

describe('PanelRenderer', () => {
  it('defers item creation', () => {
    const createItem = jasmine.createSpy().andReturn({});
    const renderer = new PanelRenderer({location: 'top', createItem});
    expect(createItem).not.toHaveBeenCalled();
    renderer.render({visible: false});
    expect(createItem).not.toHaveBeenCalled();
    renderer.render({visible: true});
    expect(createItem).toHaveBeenCalled();
    renderer.dispose();
  });

  it('shows and hides the panel', () => {
    const createItem = jasmine.createSpy().andReturn({});
    const renderer = new PanelRenderer({location: 'top', createItem});
    renderer.render({visible: true});
    const panel = renderer._panel;
    invariant(panel != null);
    spyOn(panel, 'show');
    spyOn(panel, 'hide');
    renderer.render({visible: false});
    expect(panel.hide).toHaveBeenCalled();
    renderer.render({visible: true});
    expect(panel.show).toHaveBeenCalled();
    renderer.dispose();
  });

  it('destroys the item when disposed', () => {
    const item = {
      createElement: () => document.createElement('div'),
      destroy: jasmine.createSpy(),
    };
    const createItem = () => item;
    const renderer = new PanelRenderer({location: 'top', createItem});
    // Force the creation of the item.
    renderer.render({visible: true});
    expect(item.destroy).not.toHaveBeenCalled();
    renderer.dispose();
    expect(item.destroy).toHaveBeenCalled();
    expect(item.destroy.calls.length).toBe(1);
  });
});
