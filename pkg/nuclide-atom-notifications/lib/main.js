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

import type {Level, ConsoleService} from '../../nuclide-console/lib/types';

import {CompositeDisposable} from 'atom';
import marked from 'marked';
import createPackage from 'nuclide-commons-atom/createPackage';

class Activation {
  _disposables: CompositeDisposable;

  constructor() {
    this._disposables = new CompositeDisposable();
  }

  consumeConsoleService(createConsole: ConsoleService): IDisposable {
    const consoleApi = createConsole({
      id: 'Atom',
      name: 'Atom',
    });
    const notificationDisposable = atom.notifications.onDidAddNotification(
      notification => {
        consoleApi.append({
          text: stripFormatting(notification.getMessage()),
          level: getLevel(notification.getType()),
        });
      },
    );
    this._disposables.add(consoleApi, notificationDisposable);
    return notificationDisposable;
  }

  dispose() {
    this._disposables.dispose();
  }
}

function getLevel(atomNotificationType: string): Level {
  switch (atomNotificationType) {
    case 'error':
    case 'fatal':
      return 'error';
    case 'info':
      return 'info';
    case 'warning':
      return 'warning';
    case 'success':
      return 'success';
    default:
      return 'log';
  }
}

let formattingDiv;
/**
 * Markdown and HTML can be used with Atom notifications, but not in the console. In order to strip
 * all of the formatting, we'll first compile the markdown, then use a DOM element to convert that
 * to raw text. This isn't the most performant way to strip the HTML, but it does handle `<br />`s
 * and stuff really easily and only happens once per notification so it's okay.
 */
function stripFormatting(raw: string): string {
  const div =
    formattingDiv == null
      ? (formattingDiv = document.createElement('div'))
      : formattingDiv;
  div.innerHTML = marked(raw);
  return div.innerText || '';
}

createPackage(module.exports, Activation);
