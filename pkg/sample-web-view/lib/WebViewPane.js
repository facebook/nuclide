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

/* global HTMLElement */

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import {Emitter} from 'atom';

class WebViewPane extends HTMLElement {
  _title: string;
  _subscriptions: UniversalDisposable;
  _emitter: Emitter;
  _webview: WebviewElement;

  // When it comes to ES6 classes and HTML5 custom elements, "constructors don't really work yet":
  //
  //   http://h3manth.com/new/blog/2015/custom-elements-with-es6/
  //
  // As such, we must override createdCallback() instead:
  //
  //  http://www.html5rocks.com/en/tutorials/webcomponents/customelements/#lifecycle.
  //
  // This is probably confusing for Flow because it cannot tell which properties are defined during
  // initialization since this is not the constructor.
  createdCallback(): mixed {
    this._title = 'Loading...';
    this._subscriptions = new UniversalDisposable();
    this._emitter = new Emitter();
    this._subscriptions.add(this._emitter);

    // The <webview> element is an element specific to Electron (the framework on which
    // Atom is built). It is similar to an <iframe>, but has some additional features:
    //
    // https://github.com/atom/electron/blob/master/docs/api/web-view-tag.md
    //
    // Most importantly, it runs in a separate process from Atom, so JavaScript that
    // runs in the web page that you load via the <webview> cannot access the JavaScript
    // running in Atom by default (which is important for security). If you want to communicate
    // between Atom and the webview, you can use webview's API.

    const webview = ((document.createElement('webview'): any): WebviewElement);

    this._webview = webview;

    webview.addEventListener('page-title-set', (event: Event) => {
      if (typeof event.title === 'string') {
        this._title = event.title;
        this._emitter.emit('did-change-title');
      }
    });

    // Unfortunately, page-title-set never seems to fire, so we listen for frame loads and update
    // the title based on those instead.
    webview.addEventListener('did-frame-finish-load', (event: Event) => {
      // flowlint-next-line sketchy-null-mixed:off
      if (event.isMainFrame) {
        this._title = webview.getTitle();
        this._emitter.emit('did-change-title');
      }
    });

    this.appendChild(webview);
  }

  get src() {
    return this._webview.src;
  }

  set src(src: string) {
    this._webview.src = src;
  }

  // This method needs to be present for TabView.
  getTitle(): string {
    return this._title;
  }

  // TabView checks for the existence of this method and uses it if it is available:
  // https://github.com/atom/tabs/blob/master/lib/tab-view.coffee.
  onDidChangeTitle(callback: () => any): IDisposable {
    return this._emitter.on('did-change-title', callback);
  }

  destroy() {
    this._subscriptions.dispose();
  }
}

export default document.registerElement('sample-web-view', {
  prototype: WebViewPane.prototype,
});
