/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import * as React from 'react';
import {Button} from './Button';
import showModal from './showModal';

function ModalButton() {
  return <Button onClick={showExampleModal}>Show Modal</Button>;
}

function showExampleModal() {
  showModal(({dismiss}) => {
    return (
      <div>
        <div>
          I'm a modal. You can add any content you like. I have all the standard
          behavior, like obeying the "core:cancel" command!
        </div>
        <Button onClick={dismiss}>Hide Modal</Button>
      </div>
    );
  });
}

export const ModalExamples = {
  sectionName: 'Modal',
  description: 'Overlays that cover the entire screen. ',
  examples: [
    {
      title: 'Click the button to toggle a modal:',
      component: ModalButton,
    },
  ],
};
