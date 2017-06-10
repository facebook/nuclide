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

import {Checkbox} from '../Checkbox';
import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-addons-test-utils';

let hostEl;

function createWithProps(props) {
  return ReactDOM.render(<Checkbox {...props} />, hostEl);
}

describe('Checkbox', () => {
  beforeEach(() => {
    hostEl = document.createElement('div');
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(hostEl);
    hostEl = null;
  });

  it('onChange handler fires when change event dispatched from checkbox', () => {
    const onChange = jasmine.createSpy();
    const reactElement = createWithProps({
      checked: false,
      label: 'click me!',
      onChange,
    });

    const inputEl = TestUtils.findRenderedDOMComponentWithTag(
      reactElement,
      'input',
    );
    // Unfortunately, TestUtils does not seem to turn a click into a change event for a checkbox.
    TestUtils.Simulate.change(inputEl);
    expect(onChange.callCount).toBe(1);

    // Nor does it seem to change the state of the checkbox, as the following fails:
    //   expect(inputEl.checked).toBe(true);
    // Presumably this is because TestUtils deals only with synthetic events, not native ones.
  });

  it('sets `indeterminate` on the element instance', () => {
    const reactElement = createWithProps({
      checked: false,
      indeterminate: true,
      label: 'click me!',
      onChange() {},
    });

    const inputEl = TestUtils.findRenderedDOMComponentWithTag(
      reactElement,
      'input',
    );
    expect(inputEl.indeterminate).toBe(true);
  });
});
