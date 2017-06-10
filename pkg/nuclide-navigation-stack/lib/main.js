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

import {onDidRemoveProjectPath} from 'nuclide-commons-atom/projects';
import {
  getViewOfEditor,
  isValidTextEditor,
} from 'nuclide-commons-atom/text-editor';
import {NavigationStackController} from './NavigationStackController';
import {trackTiming} from '../../nuclide-analytics';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observeNavigatingEditors} from 'nuclide-commons-atom/go-to-location';
import createPackage from 'nuclide-commons-atom/createPackage';
import {consumeStatusBar} from './StatusBar';

const controller = new NavigationStackController();

class Activation {
  _disposables: UniversalDisposable;

  constructor(state: ?Object) {
    this._disposables = new UniversalDisposable();

    const subscribeEditor = (editor: atom$TextEditor) => {
      const cursorSubscription = editor.onDidChangeCursorPosition(
        (event: ChangeCursorPositionEvent) => {
          controller.updatePosition(editor, event.newBufferPosition);
        },
      );
      const scrollSubscription = getViewOfEditor(
        editor,
      ).onDidChangeScrollTop(scrollTop => {
        controller.updateScroll(editor, scrollTop);
      });
      this._disposables.add(cursorSubscription);
      this._disposables.add(scrollSubscription);
      const destroySubscription = editor.onDidDestroy(() => {
        controller.onDestroy(editor);
        this._disposables.remove(cursorSubscription);
        this._disposables.remove(scrollSubscription);
        this._disposables.remove(destroySubscription);
      });
      this._disposables.add(destroySubscription);
    };

    const addEditor = (addEvent: AddTextEditorEvent) => {
      const editor = addEvent.textEditor;
      if (isValidTextEditor(editor)) {
        subscribeEditor(editor);
        controller.onCreate(editor);
      }
    };

    atom.workspace.getTextEditors().forEach(subscribeEditor);
    this._disposables.add(
      atom.workspace.onDidAddTextEditor(addEditor),
      atom.workspace.onDidOpen((event: OnDidOpenEvent) => {
        if (isValidTextEditor(event.item)) {
          controller.onOpen((event.item: any));
        }
      }),
      atom.workspace.observeActivePaneItem(item => {
        if (isValidTextEditor(item)) {
          controller.onActivate((item: any));
        }
      }),
      atom.workspace.onDidStopChangingActivePaneItem(item => {
        if (isValidTextEditor(item)) {
          controller.onActiveStopChanging((item: any));
        }
      }),
      onDidRemoveProjectPath(path => {
        controller.removePath(
          path,
          atom.project.getDirectories().map(directory => directory.getPath()),
        );
      }),
      observeNavigatingEditors().subscribe(editor => {
        controller.onOptInNavigation(editor);
      }),
      atom.commands.add(
        'atom-workspace',
        'nuclide-navigation-stack:navigate-forwards',
        () => {
          trackTiming('nuclide-navigation-stack:forwards', () =>
            controller.navigateForwards(),
          );
        },
      ),
      atom.commands.add(
        'atom-workspace',
        'nuclide-navigation-stack:navigate-backwards',
        () => {
          trackTiming('nuclide-navigation-stack:backwards', () =>
            controller.navigateBackwards(),
          );
        },
      ),
    );
  }

  consumeStatusBar(statusBar: atom$StatusBar): IDisposable {
    const disposable = consumeStatusBar(statusBar, controller);
    this._disposables.add(disposable);
    return disposable;
  }

  dispose() {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
