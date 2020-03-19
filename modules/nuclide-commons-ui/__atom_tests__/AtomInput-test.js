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
import {sleep} from 'nuclide-commons/promise';
import {AtomInput} from '../AtomInput';
import * as React from 'react';
import ReactDOM from 'react-dom';

let reactElement: any;

function createWithProps(props: any): any {
  const hostEl = document.createElement('div');
  return ReactDOM.render(<AtomInput {...props} />, hostEl);
}

describe('AtomInput', () => {
  afterEach(() => {
    if (reactElement) {
      ReactDOM.unmountComponentAtNode(
        // $FlowFixMe
        ReactDOM.findDOMNode(reactElement).parentNode,
      );
    }
    reactElement = null;
  });

  it('honors the initialValue param', () => {
    reactElement = createWithProps({initialValue: 'some text'});
    expect(reactElement.getText()).toBe('some text');
    expect(reactElement.getTextEditor().getText()).toBe('some text');
  });

  it('onDidChange() does not fire initially', () => {
    const initialValue = 'some text';
    const onDidChange = jest.fn();
    reactElement = createWithProps({
      initialValue,
      onDidChange,
    });

    expect(onDidChange).not.toHaveBeenCalled();
  });

  it('onDidChange() is fired when the text changes', () => {
    const initialValue = 'some text';
    reactElement = createWithProps({initialValue});
    const onDidChange = jest.fn();
    const disposable = reactElement.onDidChange(onDidChange);

    reactElement.setText('the new text');
    expect(onDidChange.mock.calls.length).toBe(1);

    reactElement.setText('even more new text');
    expect(onDidChange.mock.calls.length).toBe(2);

    disposable.dispose();
    reactElement.setText('the last update');
    expect(onDidChange.mock.calls.length).toBe(2);
  });

  it('updates will stop firing when the component is unmounted', () => {
    const initialValue = 'some text';
    const onDidChange = jest.fn();
    reactElement = createWithProps({initialValue, onDidChange});

    const textEditor = reactElement.getTextEditor();
    textEditor.setText('the new text');
    expect(onDidChange.mock.calls.length).toBe(1);

    ReactDOM.unmountComponentAtNode(
      // $FlowFixMe
      ReactDOM.findDOMNode(reactElement).parentNode,
    );
    reactElement = null;

    textEditor.setText('even more new text');
    expect(onDidChange.mock.calls.length).toBe(1);
  });

  it('does not leak TextEditorComponent', async () => {
    const hostEl = document.createElement('div');
    const component = ReactDOM.render(<AtomInput />, hostEl);
    const textEditor = component.getTextEditor();
    const element = textEditor.getElement();
    ReactDOM.unmountComponentAtNode(hostEl);

    // Cleanup occurs during the next tick.
    await sleep(0);
    expect(element.component).toBe(null);
  });
});
