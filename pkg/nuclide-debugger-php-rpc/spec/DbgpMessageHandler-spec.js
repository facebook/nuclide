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

import {makeMessage, makeDbgpMessage} from '../lib/helpers';
import {DbgpMessageHandler} from '../lib/DbgpMessageHandler';

const payload =
  '<?xml version="1.0" encoding="iso-8859-1"?>' +
  '<response xmlns="urn:debugger_protocol_v1" xmlns:xdebug="http://xdebug.org/dbgp/xdebug"' +
  ' command="property_value" transaction_id="14"><property name="$narrow" fullname="$narrow"' +
  ' address="140040883635904" type="bool"><![CDATA[0]]></property></response>';

describe('debugger-php-rpc DbgpMessageHandler', () => {
  let messageHandler: any;

  beforeEach(() => {
    spyOn(console, 'log'); // Suppress logger messages.
    messageHandler = new DbgpMessageHandler();
  });

  afterEach(() => {
    messageHandler.clearIncompletedMessage();
  });

  it('single completed message', () => {
    const message = makeMessage(
      {
        command: 'context_names',
        transaction_id: '1',
      },
      '<context name="Local" id="0"/>' +
        '<context name="Global" id="1"/>' +
        '<context name="Class" id="2"/>',
    );
    const results = messageHandler.parseMessages(message);
    expect(results.length).toBe(1);
  });

  it('two completed messages', () => {
    const message1 = makeMessage(
      {
        command: 'context_names',
        transaction_id: '1',
      },
      '<context name="Local" id="0"/>' +
        '<context name="Global" id="1"/>' +
        '<context name="Class" id="2"/>',
    );
    const message2 = makeMessage(
      {
        command: 'context_names',
        transaction_id: '2',
      },
      '<context name="Local2" id="0"/>' +
        '<context name="Global2" id="1"/>' +
        '<context name="Class2" id="2"/>',
    );
    const results = messageHandler.parseMessages(message1 + message2);
    expect(results.length).toBe(2);
  });

  it('single incompleted message', () => {
    const completedMessage = makeDbgpMessage(payload);
    const messagePart1 = completedMessage.slice(0, -20);
    const messagePart2 = completedMessage.slice(-20);

    let results = messageHandler.parseMessages(messagePart1);
    expect(results.length).toBe(0);

    results = messageHandler.parseMessages(messagePart2);
    expect(results.length).toBe(1);
  });

  it('one completed message with one incompleted message ending', () => {
    const completedMessage1 = makeMessage(
      {
        command: 'context_names',
        transaction_id: '1',
      },
      '<context name="Local" id="0"/>' +
        '<context name="Global" id="1"/>' +
        '<context name="Class" id="2"/>',
    );

    const completedMessage2 = makeDbgpMessage(payload);
    const messagePart1 = completedMessage2.slice(0, -20);
    const messagePart2 = completedMessage2.slice(-20);

    let results = messageHandler.parseMessages(
      completedMessage1 + messagePart1,
    );
    expect(results.length).toBe(1);

    results = messageHandler.parseMessages(messagePart2);
    expect(results.length).toBe(1);
  });

  it('single message in three incompleted parts', () => {
    const completedMessage = makeDbgpMessage(payload);
    const messagePart1 = completedMessage.slice(0, -50);
    const messagePart2 = completedMessage.slice(-50, -20);
    const messagePart3 = completedMessage.slice(-20);

    let results = messageHandler.parseMessages(messagePart1);
    expect(results.length).toBe(0);

    results = messageHandler.parseMessages(messagePart2);
    expect(results.length).toBe(0);

    results = messageHandler.parseMessages(messagePart3);
    expect(results.length).toBe(1);
  });

  it('completed message with bad ending', () => {
    const completedMessageBadEnding = makeDbgpMessage(payload) + 'badEnding';

    expect(() => {
      messageHandler.parseMessages(completedMessageBadEnding);
    }).toThrow();
  });

  it('completed message in incompleted message format', () => {
    const completedMessageWithoutNull = makeDbgpMessage(payload).slice(-1);

    expect(() => {
      messageHandler.parseMessages(completedMessageWithoutNull);
    }).toThrow();
  });

  it('extra messages without completing previous message', () => {
    const completedMessage1 = makeDbgpMessage(payload);
    const messagePart1 = completedMessage1.slice(0, -50);
    const messagePart2 = completedMessage1.slice(-50, -20);

    const completedMessage2 = makeMessage(
      {
        command: 'context_names',
        transaction_id: '1',
      },
      '<context name="Local" id="0"/>' +
        '<context name="Global" id="1"/>' +
        '<context name="Class" id="2"/>',
    );

    const results = messageHandler.parseMessages(messagePart1);
    expect(results.length).toBe(0);

    expect(() => {
      messageHandler.parseMessages(messagePart2 + '\x00' + completedMessage2);
    }).toThrow();
  });

  it('got incompleted message in the middle of array', () => {
    const completedMessage1 = makeDbgpMessage(payload);
    const IncompletedMessage = makeDbgpMessage(payload).slice(-5) + '\x00';
    const completedMessage2 = makeDbgpMessage(payload);

    expect(() => {
      messageHandler.parseMessages(
        completedMessage1 + IncompletedMessage + completedMessage2,
      );
    }).toThrow();
  });
});
