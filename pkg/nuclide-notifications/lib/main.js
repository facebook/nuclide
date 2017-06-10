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

import invariant from 'assert';
import electron from 'electron';
import {CompositeDisposable} from 'atom';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {Disposable} from 'atom';

const {remote} = electron;
invariant(remote != null);

let subscriptions: CompositeDisposable = (null: any);

export function activate(state: ?Object): void {
  subscriptions = new CompositeDisposable(
    // Listen for Atom notifications:
    atom.notifications.onDidAddNotification(proxyToNativeNotification),
  );
}

function proxyToNativeNotification(notification: atom$Notification): void {
  const options = notification.getOptions();

  // Don't proceed if user only wants 'nativeFriendly' proxied notifications and this isn't one.
  if (
    !options.nativeFriendly &&
    featureConfig.get('nuclide-notifications.onlyNativeFriendly')
  ) {
    return;
  }

  raiseNativeNotification(
    `${upperCaseFirst(notification.getType())}: ${notification.getMessage()}`,
    options.detail,
    0,
    false,
  );
}

function raiseNativeNotification(
  title: string,
  body: string,
  timeout: number,
  raiseIfAtomHasFocus: boolean = false,
): ?IDisposable {
  const sendNotification = () => {
    if (
      raiseIfAtomHasFocus === false &&
      !featureConfig.get('nuclide-notifications.whenFocused') &&
      remote.getCurrentWindow().isFocused()
    ) {
      return;
    }

    // eslint-disable-next-line no-new, no-undef
    new Notification(title, {
      body,
      icon: 'atom://nuclide/pkg/nuclide-notifications/notification.png',
    });
  };

  if (timeout === 0) {
    sendNotification();
  } else {
    const currentWindow = remote.getCurrentWindow();
    if (raiseIfAtomHasFocus !== false || !currentWindow.isFocused()) {
      const timeoutId = setTimeout(() => {
        sendNotification();
      }, timeout);

      currentWindow.once('focus', () => {
        clearTimeout(timeoutId);
      });

      return new Disposable(() => clearTimeout(timeoutId));
    }
  }

  return null;
}

export function provideRaiseNativeNotification(): typeof raiseNativeNotification {
  return raiseNativeNotification;
}

export function deactivate(): void {
  subscriptions.dispose();
  subscriptions = (null: any);
}

function upperCaseFirst(str: string): string {
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}
