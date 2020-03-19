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

/* global MutationObserver */

import invariant from 'assert';
import {remote, ipcRenderer} from 'electron';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import type {BrowserWindow} from 'nuclide-commons/electron-remote';

type Props = {
  children: React.Element<any>,
  width: number,
  height: number,
  title?: string,
  allowPopIn?: boolean,
  onPopoutClosed?: () => void,
  onPopoutOpened?: (popoutView: PopoutView) => void,
};

type State = {
  isPoppedOut: boolean,
};

// Unique ID for each popout window instance so that the target of IPC
// messages can be identified.
let popoutWindowId = 1;

export class PopoutView extends React.Component<Props, State> {
  props: Props;
  state: State;
  _popoutPane: ?BrowserWindow;
  _disposables: UniversalDisposable;
  _prepared: boolean;
  _popoutWindowId: string;

  constructor(props: Props) {
    super(props);

    this._popoutPane = null;
    this._prepared = false;
    this._disposables = new UniversalDisposable();

    (this: any).togglePopout = this.togglePopout.bind(this);
    (this: any)._destroyPopOutPane = this._destroyPopOutPane.bind(this);
    (this: any)._update = this._update.bind(this);
    (this: any)._ipcMessageHandler = this._ipcMessageHandler.bind(this);

    this._popoutWindowId = 'nuclide-msg-' + popoutWindowId++;
    invariant(ipcRenderer != null);
    ipcRenderer.on(this._popoutWindowId, this._ipcMessageHandler);

    this._disposables.add(
      () => {
        this._destroyPopOutPane();
      },
      () => {
        ipcRenderer.removeListener(
          this._popoutWindowId,
          this._ipcMessageHandler,
        );
      },
    );

    this.state = {
      isPoppedOut: true,
    };
  }

  dispose() {
    this._disposables.dispose();
  }

  togglePopout(isPoppedOut: boolean) {
    this.setState({
      isPoppedOut,
    });
  }

  show() {
    if (this._popoutPane != null) {
      // If the popout window exists, display it and give it focus.
      this._popoutPane.show();
    }
  }

  componentDidMount(): void {
    this._update();

    const observer = new MutationObserver((mutations, obs) => {
      // TODO: be more efficient by computing delta and only updating what actually changed.
      const container = ReactDOM.findDOMNode(this);
      invariant(container != null && container.innerHTML != null);

      this._callJsFunctionInPopoutWindow(
        this._updateContent,
        container.innerHTML,
      );
    });
    const node = ReactDOM.findDOMNode(this);
    invariant(node != null);
    observer.observe(node, {
      childList: true,
      subtree: true,
    });
    this._disposables.add(() => observer.disconnect());
  }

  componentWillUnmount() {
    this.dispose();
  }

  _update(): void {
    // Remove the current children.
    if (this._prepared && this._popoutPane != null) {
      const container = ReactDOM.findDOMNode(this);
      invariant(container != null);

      while (container.lastChild != null) {
        container.removeChild(container.lastChild);
      }

      // Render children into a host element.
      const el = renderReactRoot(this.props.children);
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.overflow = 'auto';
      container.appendChild(el);

      this._callJsFunctionInPopoutWindow(this._updateContent, el.innerHTML);
      if (this._popoutPane != null) {
        this._popoutPane.show();
      }

      if (this.props.onPopoutOpened != null) {
        this.props.onPopoutOpened(this);
      }
    }
  }

  render(): React.Element<any> {
    if (this.state.isPoppedOut) {
      if (this._popoutPane == null) {
        this._createPopOutPane();
      }
    } else {
      if (this._popoutPane != null) {
        this._destroyPopOutPane();
      }
    }

    const display = this.state.isPoppedOut
      ? 'none'
      : this.props.allowPopIn
        ? 'block'
        : 'none';

    return <div style={{display}}>{this.props.children}</div>;
  }

  /**
   * Receives IPC messages from Electron for the child window.
   */
  _ipcMessageHandler(e: any, ipcArgs: any) {
    const messageType = ipcArgs[0];
    switch (messageType) {
      case 'child-window-ready':
        // This IPC event is sent by the child window when it is set up and ready.
        // Inject all the child nodes and show the window.
        this._prepareContainer();
        this._update();

        invariant(this._popoutPane != null);
        this._popoutPane.show();
        break;
    }
  }

  _createPopOutPane() {
    if (this._popoutPane != null) {
      this._destroyPopOutPane();
    }

    invariant(remote != null);
    this._popoutPane = new remote.BrowserWindow({
      titleBarStyle: 'hidden',
      toolbar: false,
      title: this.props.title != null ? this.props.title : 'Nuclide',
      width: this.props.width,
      height: this.props.height,
      show: false,
      webPreferences: {
        devTools: false,
      },
    });

    invariant(this._popoutPane != null);
    this._popoutPane.setMenuBarVisibility(false);

    invariant(this._popoutPane != null);
    this._popoutPane.loadURL(document.URL);

    invariant(this._popoutPane != null);
    this._popoutPane.on('closed', () => {
      this._destroyPopOutPane();
      this.togglePopout(false);
    });

    this._wrapAndInjectFunctions([
      this._addContainer,
      this._updateContent,
      this._sendToMainWindow,
      this._addStyles,
      this._notifyReady,
    ]);
  }

  /**
   * Adds a container to serve as our root element in the child window and injects
   * all of the current Atom window's CSS styles into the child window.
   */
  _prepareContainer() {
    this._callJsFunctionInPopoutWindow(this._addContainer);

    // TODO: (Ericblue) can this be more efficient?
    // $FlowFixMe
    for (const element of atom.styles.styleElements) {
      this._callJsFunctionInPopoutWindow(this._addStyles, element.innerHTML);
    }

    this._prepared = true;
  }

  _destroyPopOutPane() {
    if (this._popoutPane != null) {
      try {
        this._popoutPane.close();
        invariant(this._popoutPane != null);
        this._popoutPane.destroy();
      } catch (_) {
        // It may not be possible to call close or destroy on the browser object
        // proxy if the remote electron process has been terminated already.
        // This is fine, it means we don't need to clean it up explicitly anyway.
      }

      this._popoutPane = null;
      this._prepared = false;
    }

    if (this.props.onPopoutClosed) {
      this.props.onPopoutClosed();
    }
  }

  /**
   * Marshals a function call and its arguments and invokes a corresponding JS
   * routine in the child window.
   */
  _callJsFunctionInPopoutWindow(func: Function, ...args: Array<mixed>) {
    if (this._popoutPane != null) {
      try {
        const ipcArgs = args != null ? [func.name].concat(args) : [func.name];
        this._popoutPane.webContents.send(this._popoutWindowId, ipcArgs);
      } catch (e) {}
    }
  }

  /**
   * Injects JS from this script into the child window so we can conveniently call
   * those routines in the child window's context without having to send every script
   * as text and use executeJavaScript(). This lets us use executeJavaScript() to
   * bootstrap and then rely on normal looking JS functions (with flow typing) for
   * the rest of our operations.
   */
  _wrapAndInjectFunctions(functions: Array<Function>) {
    // Set up some globals in the remote window so it knows how to find the main window to communicate.
    invariant(this._popoutPane != null);
    this._popoutPane.webContents.executeJavaScript('window.nuclideIpc = {};');

    invariant(this._popoutPane != null);
    invariant(remote != null);
    this._popoutPane.webContents.executeJavaScript(
      `window.nuclideIpc.parentWindowId = ${remote.getCurrentWindow().id}`,
    );

    invariant(this._popoutPane != null);
    this._popoutPane.webContents.executeJavaScript(
      `window.nuclideIpc.ipcId = '${this._popoutWindowId}'`,
    );

    invariant(this._popoutPane != null);
    this._popoutPane.webContents.executeJavaScript(
      'window.nuclideIpc.helperFuncs = {};',
    );

    // Hook up the IPC channel listener for the renderer.
    invariant(this._popoutPane != null);
    this._popoutPane.webContents.executeJavaScript(`
      require('electron').ipcRenderer.on('${
        this._popoutWindowId
      }', function(e, ipcArgs) {
        try {
          if (ipcArgs != null) {
            const funcName = ipcArgs[0];
            const args = ipcArgs.length > 1 ? ipcArgs.slice(1) : [];
            if (window.nuclideIpc.helperFuncs[funcName] != null) {
              window.nuclideIpc.helperFuncs[funcName].apply(window, args);
            }
          }
        } catch (e) {
          console.log(e.toString());
        }
      });
    `);

    // Inject each of the helper functions into the remote window.
    for (const func of functions) {
      // Func.toString() gets the transpiled source of the JS routine we want. Convert it to
      // the correct form "function foo(args) {...}" and inject it into the child window.
      const funcLambda = func
        .toString()
        .replace(/\n/g, ' ')
        .replace(/^[^()]+(\([^)]*\))(.*)$/, 'function $1 $2; ');
      invariant(this._popoutPane != null);
      this._popoutPane.webContents.executeJavaScript(
        `window.nuclideIpc.helperFuncs['${func.name}'] = ${funcLambda}`,
      );
    }

    // Have the child window correct its size, loading the Atom document URL overrides
    // the window size passed to the constructor of BrowserWindow.
    invariant(this.props.width != null && this.props.height != null);
    invariant(this._popoutPane != null);
    this._popoutPane.webContents.executeJavaScript(
      `window.resizeTo(${this.props.width}, ${this.props.height})`,
    );

    // Have the child window signal via IPC that its finished initializing.
    invariant(this._popoutPane != null);
    this._popoutPane.webContents.executeJavaScript(
      "window.nuclideIpc.helperFuncs['_notifyReady']();",
    );
  }

  // ////////////////////////////////////////
  // Functions used by the popout window. //
  // ////////////////////////////////////////

  /**
   * Adds a container div to the child window. All of the contents will become children
   * of this container.
   */
  _addContainer(): void {
    const host = document.createElement('div');
    host.id = 'nuclide-popout-container-root';
    host.style =
      /* $FlowFixMe */
      'padding: 0px; width: 100%; height: 100%; margin: 0px; border: 0px;';
    if (document.body != null) {
      document.body.appendChild(host);
    }
  }

  /**
   * Replaces the contents of the container in the child window wiht the specified
   * innerHTML.
   */
  _updateContent(content: string): void {
    const elem = document.getElementById('nuclide-popout-container-root');
    if (elem != null) {
      elem.innerHTML = content;
    }
  }

  /**
   * Sends a notification to the parent window that the child window has loaded
   * and finished initializing its IPC globals.
   */
  _notifyReady(): void {
    window.nuclideIpc.helperFuncs._sendToMainWindow('child-window-ready');
  }

  /**
   * Helper routine to send an event to the main window from the child window.
   */
  _sendToMainWindow(eventName: string, ...args: Array<mixed>): void {
    const ipcId = window.nuclideIpc.ipcId;
    if (window.nuclideIpc.mainWindowWebContents == null) {
      const rem = require('electron').remote;
      if (rem != null) {
        const {webContents} = rem;
        window.nuclideIpc.mainWindowWebContents = webContents.fromId(
          window.nuclideIpc.parentWindowId,
        );
      }
    }

    if (window.nuclideIpc.mainWindowWebContents != null) {
      window.nuclideIpc.mainWindowWebContents.send(ipcId, [eventName, ...args]);
    }
  }

  /**
   * Adds the specified CSS to the child window's style sheets.
   */
  _addStyles(styles: string) {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = styles;
    if (document.head != null) {
      document.head.appendChild(styleElement);
    }
  }
}
