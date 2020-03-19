/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
jest.unmock('nuclide-commons/analytics');

import createAutocompleteProvider from '../lib/createAutocompleteProvider';
import waitsFor from '../../../jest/waits_for';

describe('getSuggestions', () => {
  const fakeRequest: any = {
    bufferPosition: {},
    editor: {
      getPath: () => '',
    },
  };
  const autocompleteProviderThatThrowsExecption = createAutocompleteProvider(
    {
      selector: '',
      getSuggestions() {
        throw new Error();
      },
      analytics: {
        eventName: 'test',
        shouldLogInsertedSuggestion: false,
      },
    },
    () => 3000,
  );

  const autocompleteProviderThatTimeOut = createAutocompleteProvider(
    {
      selector: '',
      getSuggestions() {
        return new Promise((resolve, reject) => {
          setTimeout(() => resolve(null), 5000);
        });
      },
      analytics: {
        eventName: 'test',
        shouldLogInsertedSuggestion: false,
      },
    },
    () => 3000,
  );

  let trackSpy;
  beforeEach(() => {
    jest.restoreAllMocks();
    trackSpy = jest.spyOn(require('nuclide-commons/analytics'), 'track');
  });

  it('returns null when it throws an exception', async () => {
    expect(
      await autocompleteProviderThatThrowsExecption.getSuggestions(
        ({...fakeRequest, activatedManually: false}: any),
      ),
    ).toBe(null);
    expect(
      await autocompleteProviderThatThrowsExecption.getSuggestions(
        ({...fakeRequest, activatedManually: true}: any),
      ),
    ).toBe(null);
  });

  it('tracks when it throws an exception', async () => {
    await autocompleteProviderThatThrowsExecption.getSuggestions(fakeRequest);
    waitsFor(() => trackSpy.mock.calls.length > 0);
    expect(trackSpy.mock.calls).toHaveLength(1);
    expect(trackSpy.mock.calls[0][0]).toBe(
      'test:autocomplete:error-on-get-suggestions',
    );
  });

  it('tracks when it times out', async () => {
    expect(
      await autocompleteProviderThatTimeOut.getSuggestions(fakeRequest),
    ).toBe(null);
    expect(trackSpy.mock.calls.length).toBe(1);
    expect(trackSpy.mock.calls[0][0]).toBe(
      'test:autocomplete:timeout-on-get-suggestions',
    );
  });
});
