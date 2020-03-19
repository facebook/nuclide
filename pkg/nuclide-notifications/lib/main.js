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
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import featureConfig from 'nuclide-commons-atom/feature-config';
import sanitizeHtml from 'nuclide-commons/sanitizeHtml';

const {remote} = electron;
invariant(remote != null);

let subscriptions: UniversalDisposable = (null: any);

export function activate(state: ?Object): void {
  subscriptions = new UniversalDisposable(
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

  const sanitizedMessage = sanitizeHtml(notification.getMessage(), {
    condenseWhitespaces: true,
  });
  // If the message is multiline, take the first line for the title. Titles can only be a single
  // line and anything after the first line break will be ignored, at least on OSX.
  const [title, ...body] = sanitizedMessage.split(/\n/g);
  const sanitizedDescription =
    options.description == null
      ? ''
      : sanitizeHtml(options.description, {condenseWhitespaces: true});
  raiseNativeNotification(
    `${upperCaseFirst(notification.getType())}: ${title}`,
    [...body, ...sanitizedDescription.split(/\n/g)].filter(Boolean).join('\n'),
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
      onclick: () => {
        // Windows does not properly bring the window into focus.
        remote.getCurrentWindow().show();
      },
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

      return new UniversalDisposable(() => clearTimeout(timeoutId));
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
