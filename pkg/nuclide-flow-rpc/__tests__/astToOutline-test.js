/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import {astToOutline} from '../lib/astToOutline';

import classASTOld from '../__mocks__/fixtures/class-ast-old.json';
import classAST34 from '../__mocks__/fixtures/class-ast-v0.34.json';
import jasmineASTOld from '../__mocks__/fixtures/jasmine-ast-old.json';
import jasmineAST34 from '../__mocks__/fixtures/jasmine-ast-v0.34.json';
import toplevelASTOld from '../__mocks__/fixtures/toplevel-ast-old.json';
import toplevelAST34 from '../__mocks__/fixtures/toplevel-ast-v0.34.json';
import exportsASTOld from '../__mocks__/fixtures/exports-ast-old.json';
import exportsAST34 from '../__mocks__/fixtures/exports-ast-v0.34.json';
import exportsClassAST from '../__mocks__/fixtures/exports-class-ast.json';
import exportDefaultArrowFuncAST34 from '../__mocks__/fixtures/export-default-arrow-func-v0.34.json';
import exportDefaultAnonymousFuncAST34 from '../__mocks__/fixtures/export-default-anonymous-func-v0.34.json';
import typesASTOld from '../__mocks__/fixtures/types-ast-old.json';
import typesAST34 from '../__mocks__/fixtures/types-ast-v0.34.json';
import declareAST from '../__mocks__/fixtures/declare-ast.json';
import interfacesAST from '../__mocks__/fixtures/interfaces-ast.json';

describe('astToOutline', () => {
  it('should provide a class outline', () => {
    // Old version
    expect(astToOutline(classASTOld).outlineTrees).toMatchSnapshot();
    // Newer, introduced AssignmentPattern for default function args (v0.33), made a bunch of other
    // changes (v0.34)
    expect(astToOutline(classAST34).outlineTrees).toMatchSnapshot();
  });

  it('should provide an outline for miscellaneous top-level statements', () => {
    expect(astToOutline(toplevelASTOld).outlineTrees).toMatchSnapshot();
    expect(astToOutline(toplevelAST34).outlineTrees).toMatchSnapshot();
  });

  it('should provide an outline for Jasmine specs', () => {
    expect(astToOutline(jasmineASTOld).outlineTrees).toMatchSnapshot();
    expect(astToOutline(jasmineAST34).outlineTrees).toMatchSnapshot();
  });

  it('should provide an outline for module.exports', () => {
    expect(astToOutline(exportsASTOld).outlineTrees).toMatchSnapshot();
    expect(astToOutline(exportsAST34).outlineTrees).toMatchSnapshot();
  });

  it('should provide an outline for module.exports class expression assignments', () => {
    expect(astToOutline(exportsClassAST).outlineTrees).toMatchSnapshot();
  });

  it('should provide an outline for type declarations', () => {
    expect(astToOutline(typesASTOld).outlineTrees).toMatchSnapshot();
    expect(astToOutline(typesAST34).outlineTrees).toMatchSnapshot();
  });

  it('should provide an outline for export default () => {}', () => {
    expect(
      astToOutline(exportDefaultArrowFuncAST34).outlineTrees,
    ).toMatchSnapshot();
  });

  it('should provide an outline for export default function() {}', () => {
    expect(
      astToOutline(exportDefaultAnonymousFuncAST34).outlineTrees,
    ).toMatchSnapshot();
  });
  it('should provide an outline for declare class, declare module and declare function', () => {
    expect(astToOutline(declareAST).outlineTrees).toMatchSnapshot();
  });
  it('should provide an outline with interface declarations', () => {
    expect(astToOutline(interfacesAST).outlineTrees).toMatchSnapshot();
  });
});
