/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

/* eslint-disable no-unused-vars */

// Type declarations for Jasmine v1.3
// https://jasmine.github.io/1.3/introduction.html

type JasmineMatcher = {
  not: JasmineMatcher,
  toBe(expected: mixed): boolean,
  toContain(item: mixed): boolean,
  toBeCloseTo(expected: number, precision: number): boolean,
  toBeDefined(): boolean,
  toBeFalsy(): boolean,
  toBeTruthy(): boolean,
  toBeGreaterThan(expected: number): boolean,
  toBeLessThan(expected: number): boolean,
  toBeNull(): boolean,
  toBeUndefined(): boolean,
  toEqual(expected: mixed): boolean,
  toExist(): boolean,
  toHaveBeenCalled(): boolean,
  toHaveBeenCalledWith(...args: Array<mixed>): boolean,
  toMatch(expected: mixed): boolean,
  toMatchSelector(expected: string): boolean,
  toThrow(): boolean,

  // Custom Matchers from nuclide-test-helpers
  diffJson(expected: mixed): boolean,
  diffLines(expected: string): boolean,

  // Custom Matchers from nuclide-atom-test-helpers
  toEqualAtomRange(): boolean,
  toEqualAtomRanges(): boolean,
};

// Declaring, describing, and grouping tests
declare function afterEach(func: () => mixed): void;
declare function beforeEach(func: () => mixed): void;
declare function describe(title: string, spec: () => mixed): void;
declare function expect(actual: mixed): JasmineMatcher;
declare function it(title: string, spec: () => mixed): void;

// Disabling Specs and Suites
// https://jasmine.github.io/1.3/introduction.html#section-Disabling_Specs_and_Suites
declare function xdescribe(title: string, spec: () => mixed): void;
declare function xit(title: string, spec: () => mixed): void;

// Spies
// https://jasmine.github.io/1.3/introduction.html#section-Spies
type JasmineSpyCall = {
  args: Array<mixed>,
};

type JasmineSpy = {
  (...args: Array<any>): any,
  andCallFake(fake: (...args: Array<any>) => mixed): JasmineSpy,
  andCallThrough(): JasmineSpy,
  argsForCall: Array<Array<mixed>>,
  andReturn<T>(value: T): JasmineSpy,
  andThrow(error: mixed): JasmineSpy,
  callCount: number,
  calls: Array<JasmineSpyCall>,
  identity: string,
  mostRecentCall: JasmineSpyCall,
  wasCalled: boolean,
  reset(): void,
};

declare function spyOn(object: Object, method: string): JasmineSpy;

// Mocking the JavaScript Clock
// https://jasmine.github.io/1.3/introduction.html#section-Mocking_the_JavaScript_Clock
type JasmineMockClock = {
  tick(milliseconds: number): void,
  useMock(): void,
};

// Asynchronous Support
// https://jasmine.github.io/1.3/introduction.html#section-Asynchronous_Support
declare function runs(func: () => mixed): void;

// Apparently the arguments for waitsFor() can be specified in any order.
type WaitsForArg = string | number | () => mixed;

declare function waitsFor(
  latchFunction?: WaitsForArg, failureMessage?: WaitsForArg, timeout?: WaitsForArg): void;

declare function waits(milliseconds: number): void;

type JasmineEnvironment = {
  currentSpec: {
    fail(message: string): void,
  },
  defaultTimeoutInterval: number,
  afterEach: afterEach,
  beforeEach: beforeEach,
  describe: describe,
  it: it,
};

type JasmineSpec = {
  addMatchers(matchersPrototype: {[methodName: string]: (expected: any) => boolean}): void,
};

type JasmineMatchers = {
  message: () => string,
};

// Jasmine global
declare var jasmine: {
  // Default timeout.
  DEFAULT_TIMEOUT_INTERVAL: number,

  Clock: JasmineMockClock,
  Matchers: JasmineMatchers,
  any(expected: string | Object): mixed,

  /**
   * This is a non-standard method that Atom adds to Jasmine via spec-helper.coffee.
   * Ideally, we would declare this in atom-jasmine.js, but we can't extend this global here.
   */
  attachToDOM(element: Element): ?HTMLElement,

  createSpy: (name?: string) => JasmineSpy,
  createSpyObj: (name: string, spyNames: Array<string>) => {[key: string]: JasmineSpy},
  getEnv: () => JasmineEnvironment,
  pp: (value: mixed) => string,
  unspy: (obj: Object, methodName: string) => void,
  useRealClock: () => void,
};
