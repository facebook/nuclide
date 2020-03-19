/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import featureConfig from 'nuclide-commons-atom/feature-config';
import createMessageStream from '../lib/createMessageStream';
import {Observable} from 'rxjs';

describe('createMessageStream', () => {
  it('splits the output by message', async () => {
    const original = featureConfig.observeAsStream.bind(featureConfig);
    jest
      .spyOn(featureConfig, 'observeAsStream')
      .mockImplementation(
        name =>
          name === 'nuclide-adb-logcat.whitelistedTags'
            ? Observable.of('.*')
            : original(name),
      );

    const output = Observable.from([
      '[ 01-14 17:15:01.003   640:  654 I/ProcessStatsService ]',
      'Prepared write state in 0ms',
      '',
      '[ 01-14 17:15:01.003   640:  654 I/ProcessStatsService ]',
      'Prepared write state in 0ms',
      '',
    ]);

    const messages = await createMessageStream(output)
      .map(message => message.text)
      .toArray()
      .toPromise();

    expect(messages.length).toBe(2);
    messages.forEach(message => {
      expect(message).toBe('Prepared write state in 0ms');
    });
  });

  it('only includes messages with whitelisted tags', async () => {
    const original = featureConfig.observeAsStream.bind(featureConfig);
    jest
      .spyOn(featureConfig, 'observeAsStream')
      .mockImplementation(
        name =>
          name === 'nuclide-adb-logcat.whitelistedTags'
            ? Observable.of('ExampleTag')
            : original(name),
      );

    const output = Observable.from([
      '[ 01-14 17:15:01.003   640:  654 I/ProcessStatsService ]',
      'Bad',
      '',
      '[ 01-14 17:15:01.003   640:  654 I/ExampleTag ]',
      'Good',
      '',
    ]);

    const messages = await createMessageStream(output)
      .map(message => message.text)
      .toArray()
      .toPromise();

    expect(messages).toEqual(['Good']);
  });

  it('shows an error (once) if the regular expression is invalid', async () => {
    jest.spyOn(atom.notifications, 'addError').mockImplementation(() => {});
    const original = featureConfig.observeAsStream.bind(featureConfig);
    jest
      .spyOn(featureConfig, 'observeAsStream')
      .mockImplementation(
        name =>
          name === 'nuclide-adb-logcat.whitelistedTags'
            ? Observable.of('(')
            : original(name),
      );

    const output = Observable.from([
      '[ 01-14 17:15:01.003   640:  654 I/ProcessStatsService ]',
      'Bad',
      '',
      '[ 01-14 17:15:01.003   640:  654 I/ExampleTag ]',
      'Good',
      '',
    ]);
    await createMessageStream(output).toPromise();
    expect(atom.notifications.addError.mock.calls.length).toBe(1);
  });
});
