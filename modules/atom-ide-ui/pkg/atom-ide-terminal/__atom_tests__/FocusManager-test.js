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
 * @emails oncall+nuclide
 */
import {Emitter} from 'atom';
import {LastItemManager} from '../lib/FocusManager';

describe('LastItemManager', () => {
  it('ensure subscriptions are disposed, as appropriate', () => {
    const a = {};
    const b = {};
    const c = {};
    const pane = new FakePane([a, b, c]);
    jest
      .spyOn(atom.workspace, 'paneForItem')
      .mockImplementation(item => (pane.hasItem(item) ? pane : null));

    // Verify initial state.
    const manager = new LastItemManager();
    expect(manager.item).toBe(null);

    // Verify initial active item.
    manager.onActiveItem(a);
    expect(manager.item).toBe(a);
    const aDisposable = pane.lastDisposable;
    expect(aDisposable.disposed).toBe(false);

    // Activating a new item should cancel the old item's subscription.
    manager.onActiveItem(b);
    expect(manager.item).toBe(b);
    const bDisposable = pane.lastDisposable;
    expect(aDisposable.disposed).toBe(true);
    expect(bDisposable.disposed).toBe(false);

    // If the active item is destroyed, then its subscription should be
    // canceled.
    pane.removeItem(b);
    expect(manager.item).toBe(null);
    expect(bDisposable.disposed).toBe(true);

    // Activating c has no effect on b's subscription because it was already
    // canceled.
    manager.onActiveItem(c);
    expect(manager.item).toBe(c);
    const cDisposable = pane.lastDisposable;
    expect(cDisposable.disposed).toBe(false);

    // In the odd event the item does not belong to a pane, LastItemManager
    // should not change its state.
    const itemNotInAnyPane = {};
    manager.onActiveItem(itemNotInAnyPane);
    expect(cDisposable.disposed).toBe(false);
    expect(pane.lastDisposable).toBe(cDisposable);

    // Activating the existing item should not cause LastItemManager to change
    // its state.
    manager.onActiveItem(c);
    expect(cDisposable.disposed).toBe(false);
    expect(pane.lastDisposable).toBe(cDisposable);
  });
});

const WILL_REMOVE_ITEM = 'will-remove-item';

/** Fake atom$Pane for testing. */
class FakePane {
  _items: Array<Object> = [];
  _emitter: Emitter = new Emitter();

  /** Disposable returned by the last call to onWillRemoveItem(). */
  lastDisposable: atom$Disposable;

  constructor(items: Array<Object>) {
    this._items.push(...items);
  }

  hasItem(item: Object): boolean {
    return this._items.indexOf(item) >= 0;
  }

  removeItem(item: Object) {
    const index = this._items.indexOf(item);
    if (index < 0) {
      return;
    }

    this._emitter.emit(WILL_REMOVE_ITEM, {item, index});
    this._items.splice(index, 1);
  }

  onWillRemoveItem(
    callback: (event: {item: Object, index: number}) => void,
  ): IDisposable {
    const disposable = this._emitter.on(WILL_REMOVE_ITEM, callback);
    this.lastDisposable = ((disposable: any): atom$Disposable);
    return disposable;
  }
}
