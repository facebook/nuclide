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

import {getImportInformation} from '../src/Completions';

describe('Completion', () => {
  it('Should correctly parse value imports', () => {
    const importInformation = getImportInformation('import {something}');
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('something');
    expect(importInformation && importInformation.importType).toBe(
      'namedValue',
    );
    expect(importInformation && importInformation.isComplete).toBe(true);
  });
  it('Should correctly parse default imports', () => {
    const importInformation = getImportInformation('import TextDocuments ');
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('TextDocuments');
    expect(importInformation && importInformation.importType).toBe(
      'defaultValue',
    );
    expect(importInformation && importInformation.isComplete).toBe(true);
  });
  it('Should correctly parse type imports', () => {
    const importInformation = getImportInformation('import  type {SomeType }');
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('SomeType');
    expect(importInformation && importInformation.importType).toBe('namedType');
    expect(importInformation && importInformation.isComplete).toBe(true);
  });
  it('Should correctly parse multiple values', () => {
    const importInformation = getImportInformation(
      'import {one,  two, three, four}',
    );
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(4);
    expect(importInformation && importInformation.ids[0]).toBe('one');
    expect(importInformation && importInformation.ids[1]).toBe('two');
    expect(importInformation && importInformation.ids[2]).toBe('three');
    expect(importInformation && importInformation.ids[3]).toBe('four');
    expect(importInformation && importInformation.importType).toBe(
      'namedValue',
    );
    expect(importInformation && importInformation.isComplete).toBe(true);
  });
  it('Should correctly parse multiple types', () => {
    const importInformation = getImportInformation(
      'import type {One,  Two, Three, Four,}',
    );
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(4);
    expect(importInformation && importInformation.ids[0]).toBe('One');
    expect(importInformation && importInformation.ids[1]).toBe('Two');
    expect(importInformation && importInformation.ids[2]).toBe('Three');
    expect(importInformation && importInformation.ids[3]).toBe('Four');
    expect(importInformation && importInformation.importType).toBe('namedType');
  });
  it('Should ignore extra whitespace', () => {
    const importInformation = getImportInformation(
      '      import { something  }  ',
    );
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('something');
    expect(importInformation && importInformation.isComplete).toBe(true);
  });
  it('Should handle importing type defaults', () => {
    const importInformation = getImportInformation(
      'import type TextDocuments ',
    );
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('TextDocuments');
    expect(importInformation && importInformation.importType).toBe(
      'defaultType',
    );
    expect(importInformation && importInformation.isComplete).toBe(true);
  });
  it('Should handle all valid Javascript identifiers', () => {
    const importInformation = getImportInformation(
      'import {WORKSPACE_VIEW_URI, $DOLLAR_SIGNS$}',
    );
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(2);
    expect(importInformation && importInformation.ids[0]).toBe(
      'WORKSPACE_VIEW_URI',
    );
    expect(importInformation && importInformation.ids[1]).toBe(
      '$DOLLAR_SIGNS$',
    );
    expect(importInformation && importInformation.importType).toBe(
      'namedValue',
    );
    expect(importInformation && importInformation.isComplete).toBe(true);
  });
  it('Should correctly parse extra text with default imports', () => {
    const importInformation = getImportInformation(
      'import type TextDocuments someExtraText ',
    );
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('TextDocuments');
    expect(importInformation && importInformation.extraText).toBe(
      'someExtraText ',
    );
    expect(importInformation && importInformation.importType).toBe(
      'defaultType',
    );
    expect(importInformation && importInformation.isComplete).toBe(true);
  });
  it('Should correctly parse extra text with named imports', () => {
    const importInformation = getImportInformation(
      'import type {A, B , C    } from ',
    );
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(3);
    expect(importInformation && importInformation.ids[0]).toBe('A');
    expect(importInformation && importInformation.extraText).toBe('from ');
    expect(importInformation && importInformation.importType).toBe('namedType');
    expect(importInformation && importInformation.isComplete).toBe(true);
  });
  it('Should correctly parse incomplete default import', () => {
    const importInformation = getImportInformation('import TextDoc');
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('TextDoc');
    expect(importInformation && importInformation.extraText).toBe('');
    expect(importInformation && importInformation.importType).toBe(
      'defaultValue',
    );
    expect(importInformation && importInformation.isComplete).toBe(false);
  });
  it('Should correctly parse incomplete default type import', () => {
    const importInformation = getImportInformation('import type TextDoc');
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('TextDoc');
    expect(importInformation && importInformation.extraText).toBe('');
    expect(importInformation && importInformation.importType).toBe(
      'defaultType',
    );
    expect(importInformation && importInformation.isComplete).toBe(false);
  });
  it('Should correctly parse incomplete named value import', () => {
    const importInformation = getImportInformation('import {AutoImpor');
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('AutoImpor');
    expect(importInformation && importInformation.extraText).toBe('');
    expect(importInformation && importInformation.importType).toBe(
      'namedValue',
    );
    expect(importInformation && importInformation.isComplete).toBe(false);
  });
  it('Should correctly parse incomplete named type import', () => {
    const importInformation = getImportInformation('import type {AutoImpor');
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('AutoImpor');
    expect(importInformation && importInformation.extraText).toBe('');
    expect(importInformation && importInformation.importType).toBe('namedType');
    expect(importInformation && importInformation.isComplete).toBe(false);
  });
  it('Should correctly parse incomplete require', () => {
    const importInformation = getImportInformation('const CSS');
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('CSS');
    expect(importInformation && importInformation.extraText).toBe('');
    expect(importInformation && importInformation.importType).toBe(
      'requireImport',
    );
    expect(importInformation && importInformation.isComplete).toBe(false);
  });
  it('Should correctly parse complete require', () => {
    const importInformation = getImportInformation('const CSS ');
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('CSS');
    expect(importInformation && importInformation.extraText).toBe('');
    expect(importInformation && importInformation.importType).toBe(
      'requireImport',
    );
    expect(importInformation && importInformation.isComplete).toBe(true);
  });
  it('Should correctly parse the equals sign as extraText', () => {
    const importInformation = getImportInformation('const CSS = ');
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('CSS');
    expect(importInformation && importInformation.extraText).toBe('= ');
    expect(importInformation && importInformation.importType).toBe(
      'requireImport',
    );
    expect(importInformation && importInformation.isComplete).toBe(true);
  });
  it('Should not match const with leading whitespace', () => {
    let importInformation = getImportInformation(' const CSS');
    expect(importInformation).toBeNull();
    importInformation = getImportInformation('  const CSS');
    expect(importInformation).toBeNull();
    importInformation = getImportInformation('      const CSS');
    expect(importInformation).toBeNull();
  });
  it('Should correctly parse destructured require statement', () => {
    const importInformation = getImportInformation(
      'const {someId, someOtherType}',
    );
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(2);
    expect(importInformation && importInformation.ids[0]).toBe('someId');
    expect(importInformation && importInformation.ids[1]).toBe('someOtherType');
    expect(importInformation && importInformation.extraText).toBe('');
    expect(importInformation && importInformation.importType).toBe(
      'requireDestructured',
    );
    expect(importInformation && importInformation.isComplete).toBe(true);
  });
  it('Should correctly parse incomplete destructured require statement', () => {
    const importInformation = getImportInformation('const {some');
    expect(importInformation).toBeDefined();
    expect(importInformation && importInformation.ids.length).toBe(1);
    expect(importInformation && importInformation.ids[0]).toBe('some');
    expect(importInformation && importInformation.extraText).toBe('');
    expect(importInformation && importInformation.importType).toBe(
      'requireDestructured',
    );
    expect(importInformation && importInformation.isComplete).toBe(false);
  });
});
