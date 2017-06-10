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

import featureConfig from '../feature-config';

describe('main', () => {
  it('returns numbers when numbers are set', () => {
    featureConfig.set('foobar', 5);
    expect(featureConfig.get('foobar')).toEqual(5);
  });

  it('returns booleans when numbers are set', () => {
    featureConfig.set('cat', true);
    expect(featureConfig.get('cat')).toEqual(true);
  });

  it('passes values to observers on change', () => {
    const spy = jasmine.createSpy('spy');
    featureConfig.observe('animal', spy);
    featureConfig.set('animal', 'yup');
    expect(spy).toHaveBeenCalled();
  });

  it('calls callbacks passed to `onDidChange`', () => {
    const spy = jasmine.createSpy('willis');
    featureConfig.onDidChange('mars.attacks', spy);
    featureConfig.set('mars.attacks', 42);
    expect(spy).toHaveBeenCalled();
  });

  it('resets to defaults with "unset"', () => {
    featureConfig.setSchema('purple.pants', {type: 'number', default: 15});
    featureConfig.set('purple.pants', 25);
    expect(featureConfig.get('purple.pants')).toEqual(25);
    featureConfig.unset('purple.pants');
    expect(featureConfig.get('purple.pants')).toEqual(15);
  });
});
