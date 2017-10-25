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

import type {
  DiagnosticProviderUpdate,
  DiagnosticInvalidationMessage,
  DiagnosticMessageKind,
  LinterConfig,
  LinterMessageV2,
} from '../types';

import {BehaviorSubject, Observable, Subject} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {linterMessagesToDiagnosticUpdate} from '../services/LinterAdapter';

export class IndieLinterDelegate {
  _name: string;
  _supportedMessageKinds: Array<DiagnosticMessageKind>;
  _uiSettings: Array<string>;
  _messages: Array<LinterMessageV2>;
  _updates: Subject<DiagnosticProviderUpdate>;
  _invalidations: Subject<DiagnosticInvalidationMessage>;
  _destroyed: BehaviorSubject<boolean>;

  // For compatibility with the Nuclide API.
  updates: Observable<DiagnosticProviderUpdate>;
  invalidations: Observable<DiagnosticInvalidationMessage>;

  constructor(config: LinterConfig) {
    this._name = config.name;
    this._supportedMessageKinds = config.supportedMessageKinds || ['lint'];
    this._uiSettings = Object.freeze(
      config.uiSettings ? config.uiSettings.slice() : [],
    );
    this._messages = [];
    this._updates = new Subject();
    this._invalidations = new Subject();
    this._destroyed = new BehaviorSubject(false);

    this.updates = this._updates.asObservable();
    this.invalidations = this._invalidations.asObservable();
  }

  get name(): string {
    return this._name;
  }

  get supportedMessageKinds(): Array<DiagnosticMessageKind> {
    // We'll count on ourselves not to mutate this.
    return this._supportedMessageKinds;
  }

  get uiSettings(): Array<string> {
    return this._uiSettings;
  }

  getMessages(): Array<LinterMessageV2> {
    return this._messages;
  }

  clearMessages(): void {
    this._messages = [];
    this._invalidations.next({scope: 'all'});
  }

  setMessages(filePath: string, messages: Array<LinterMessageV2>): void {
    this._messages = this._messages
      .filter(message => message.location.file !== filePath)
      .concat(messages);
    this._updates.next(
      linterMessagesToDiagnosticUpdate(filePath, [...messages], this._name),
    );
  }

  setAllMessages(messages: Array<LinterMessageV2>): void {
    this.clearMessages();
    this._messages = messages;
    this._updates.next(
      linterMessagesToDiagnosticUpdate(null, [...messages], this._name),
    );
  }

  onDidUpdate(
    callback: (messages: Array<LinterMessageV2>) => mixed,
  ): IDisposable {
    return new UniversalDisposable(
      Observable.merge(this.updates, this.invalidations).subscribe(() => {
        callback(this._messages);
      }),
    );
  }

  onDidDestroy(callback: () => mixed): IDisposable {
    return new UniversalDisposable(
      this._destroyed
        .filter(Boolean)
        .take(1)
        .subscribe(callback),
    );
  }

  dispose() {
    // Guard against double-destruction.
    if (!this._destroyed.getValue()) {
      this.clearMessages();
      this._destroyed.next(true);
    }
  }
}

export default class IndieLinterRegistry {
  _delegates: Set<IndieLinterDelegate>;

  constructor() {
    this._delegates = new Set();
  }

  register(config: LinterConfig): IndieLinterDelegate {
    const delegate = new IndieLinterDelegate(config);
    this._delegates.add(delegate);
    delegate.onDidDestroy(() => {
      this._delegates.delete(delegate);
    });
    return delegate;
  }

  dispose(): void {
    this._delegates.forEach(delegate => delegate.dispose());
    this._delegates.clear();
  }
}
