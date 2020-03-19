/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 * @emails oncall+nuclide
 */
import humanizeEventName from '../humanizeEventName';

describe('humanizeEventName(eventName)', () => {
  describe('when no namespace exists', () => {
    it('undasherizes and capitalizes the event name', () => {
      expect(humanizeEventName('nonamespace')).toBe('Nonamespace');
      expect(humanizeEventName('no-name-space')).toBe('No Name Space');
    });
  });

  describe('when a namespace exists', () => {
    it('space separates the undasherized/capitalized versions of the namespace and event name', () => {
      expect(humanizeEventName('space:final-frontier')).toBe(
        'Space: Final Frontier',
      );
      expect(humanizeEventName('star-trek:the-next-generation')).toBe(
        'Star Trek: The Next Generation',
      );
    });
  });
});
