/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 * @emails oncall+nuclide
 */
/* global Element */

import invariant from 'assert';
import RadioGroup from '../RadioGroup';
import * as React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-dom/test-utils';

const {
  Simulate,
  renderIntoDocument,
  scryRenderedDOMComponentsWithTag,
} = TestUtils;

describe('RadioGroup', () => {
  it('honors the selectedIndex param', () => {
    const component = renderIntoDocument(
      <RadioGroup optionLabels={['foo', 'bar']} selectedIndex={1} />,
    );
    expect(component.props.selectedIndex).toBe(1);

    const radioInputs = scryRenderedDOMComponentsWithTag(component, 'input');

    // $FlowFixMe
    expect(ReactDOM.findDOMNode(radioInputs[0]).checked).toBe(false);
    // $FlowFixMe
    expect(ReactDOM.findDOMNode(radioInputs[1]).checked).toBe(true);
  });

  it('should use the correct, unique radio group name', () => {
    const props = {optionLabels: ['foo', 'bar'], selectedIndex: 1};
    const component = renderIntoDocument(<RadioGroup {...props} />);
    const radioInputs = scryRenderedDOMComponentsWithTag(component, 'input');
    // Global uid is `1` as this point, since this is the second RadioGroup component to be created.
    // $FlowFixMe
    expect(ReactDOM.findDOMNode(radioInputs[0]).getAttribute('name')).toEqual(
      'radiogroup-1',
    );
    // $FlowFixMe
    expect(ReactDOM.findDOMNode(radioInputs[1]).getAttribute('name')).toEqual(
      'radiogroup-1',
    );
    const component2 = renderIntoDocument(<RadioGroup {...props} />);
    const radioInputs2 = scryRenderedDOMComponentsWithTag(component2, 'input');
    // $FlowFixMe
    expect(ReactDOM.findDOMNode(radioInputs2[0]).getAttribute('name')).toEqual(
      'radiogroup-2',
    );
    // $FlowFixMe
    expect(ReactDOM.findDOMNode(radioInputs2[1]).getAttribute('name')).toEqual(
      'radiogroup-2',
    );
  });

  it('calls its onSelectedChange handler when a radio input is changed', () => {
    const onSelectedChange = jest.fn();

    const props = {
      optionLabels: ['foo', 'bar'],
      selectedIndex: 0,
      onSelectedChange,
    };
    const component = renderIntoDocument(<RadioGroup {...props} />);
    const radioInputs = scryRenderedDOMComponentsWithTag(component, 'input');
    const secondRadioElement = radioInputs[1];
    invariant(secondRadioElement instanceof Element);

    const foundRadio = ReactDOM.findDOMNode(secondRadioElement);
    invariant(foundRadio instanceof Element);
    Simulate.change(foundRadio);
    expect(onSelectedChange.mock.calls[0][0]).toEqual(1);
  });
});
