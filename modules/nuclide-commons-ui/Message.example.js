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
 */

import * as React from 'react';
import {Block} from './Block';
import {Message, MessageTypes} from './Message';

const MessageExample = (): React.Element<any> => (
  <div>
    <Block>
      <Message>
        <h2>Message</h2>
        Hello, I'm a simple message.
      </Message>
    </Block>
    <Block>
      <Message type={MessageTypes.info}>
        Hello I'm an <strong>info</strong> message.
      </Message>
    </Block>
    <Block>
      <Message type={MessageTypes.success}>
        Hello I'm a <strong>success</strong> message.
      </Message>
    </Block>
    <Block>
      <Message type={MessageTypes.warning}>
        Hello I'm a <strong>warning</strong> message.
      </Message>
    </Block>
    <Block>
      <Message type={MessageTypes.error}>
        Hello I'm an <strong>error</strong> message.
      </Message>
    </Block>
  </div>
);

export const MessageExamples = {
  sectionName: 'Messages',
  description:
    'Message boxes are used to surface issues, such as warnings, inline within Nuclide.',
  examples: [
    {
      title: 'Basic Messages',
      component: MessageExample,
    },
  ],
};
