/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

// FIXME(samgoldman) Remove top-level interface once Babel supports
// `declare interface` syntax.
interface rx$IDisposable {
  dispose(): void;
}

// FIXME(samgoldman) Remove this once Subject<T> can mixin Observer<T>
interface rx$IObserver<T> {
  onNext(value: T): mixed;
  onError(error: any): mixed;
  onCompleted(): mixed;
}

declare module 'rx' {
  declare class Observable<T> {
    static catch(...sources: Observable<T>[]): Observable<T>;

    static concat(...sources: Observable<T>[]): Observable<T>;

    static create(
      subscribe: (observer: Observer<T>) => rx$IDisposable | Function | void
    ): Observable<T>;

    static from(iterable: Iterable<T>): Observable<T>;

    static fromEvent(
      element: any,
      eventName: string,
      selector?: () => T,
    ): Observable<T>;

    static fromPromise(promise: Promise<T>): Observable<T>;

    static empty(): Observable<any>;

    static just(value: T): Observable<T>;

    static merge(sources: Observable<T>[]): Observable<T>;
    static merge(...sources: Observable<T>[]): Observable<T>;

    static of(...values: T[]): Observable<T>;

    static return(value: T): Observable<T>;

    static throw(error: any): Observable<any>;
    static throwError(error: any): Observable<any>;

    static using<Resource: rx$IDisposable>(
      resourceFactory: () => Resource,
      observableFactory: (resource: Resource) => Observable<T>,
    ): Observable<T>;

    amb(other: Observable<T>): Observable<T>;

    doOnNext(f: (value: T) => mixed): Observable<T>;

    concat(...sources: Observable<T>[]): Observable<T>;

    concatMap<U>(
      f: (value: T) => Observable<U> | Promise<U> | Iterable<U>
    ): Observable<U>;

    debounce(duration: number): Observable<T>;

    delay(dueTime: number): Observable<T>;

    distinctUntilChanged(): Observable<T>;

    filter(predicate: (value: T) => boolean): Observable<T>;

    finally(f: () => mixed): Observable<T>;

    first(): Observable<T>;

    flatMap<U>(
      f: (value: T) => Observable<U> | Promise<U> | Iterable<U>
    ): Observable<U>;

    forEach(
      onNext?: (value: T) => mixed,
      onError?: (error: any) => mixed,
      onCompleted?: () => mixed,
    ): rx$IDisposable;

    map<U>(f: (value: T) => U): Observable<U>;

    merge(other: Observable<T>): Observable<T>;

    mergeAll(): T; // assumption: T is Observable

    replay(): ConnectableObservable<T>;

    scan<U>(
      f: (acc: U, value: T) => U,
      initialValue: U,
    ): Observable<U>;

    take(count: number): Observable<T>;

    takeUntil(other: Observable<any>): Observable<T>;

    takeWhile(f: (value: T) => boolean): Observable<T>;

    throttle(duration: number): Observable<T>;

    timeout(dueTime: number, other?: Observable<T>): Observable<T>;

    toArray(): Observable<T[]>;

    toPromise(): Promise<T>;

    subscribe(
      onNext?: (value: T) => mixed,
      onError?: (error: any) => mixed,
      onCompleted?: () => mixed,
    ): rx$IDisposable;
    subscribe(observer: rx$IObserver<T>): rx$IDisposable;

    subscribeOnNext(onNext: (value: T) => mixed): rx$IDisposable;
    subscribeOnError(onError: (error: any) => mixed): rx$IDisposable;
    subscribeOnCompleted(onCompleted: () => mixed): rx$IDisposable;
  }

  declare class ConnectableObservable<T> extends Observable<T> {
    connect(): rx$IDisposable;
    refCount(): Observable<T>;
  }

  declare class Observer<T> {
    static create(
      onNext?: (value: T) => mixed,
      onError?: (error: any) => mixed,
      onCompleted?: () => mixed,
    ): Observer<T>;

    asObserver(): Observer<T>;

    onNext(value: T): mixed;

    onError(error: any): mixed;

    onCompleted(): mixed;
  }

  // FIXME(samgoldman) should be `mixins Observable<T>, Observer<T>`
  // once Babel parsing support exists: https://phabricator.babeljs.io/T6821
  declare class Subject<T> extends Observable<T> {
    asObservable(): Observable<T>;

    hasObservers(): boolean;

    dispose(): void;

    // Copied from Observer<T>
    asObserver(): Observer<T>;
    onNext(value: T): mixed;
    onError(error: any): mixed;
    onCompleted(): mixed;
  }

  declare class BehaviorSubject<T> extends Subject<T> {
    constructor(initialValue: T): void;

    getValue(): T;
  }

  declare class ReplaySubject<T> extends Subject<T> {

  }
}
