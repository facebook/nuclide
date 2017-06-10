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

import {Point} from 'atom';
import invariant from 'assert';

import busySignal from './utils/busy-signal-common';
import {describeRemotableTest} from './utils/remotable-tests';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {copyFixture} from '../pkg/nuclide-test-helpers';
import {waitsForFile} from '../pkg/commons-atom/testHelpers';

describeRemotableTest('Clang Refactorizer Test', context => {
  let testDir: string;
  let textEditor: atom$TextEditor;
  beforeEach(() => {
    waitsForPromise({timeout: 30000}, async () => {
      testDir = await copyFixture('cpp_project_2', __dirname);
      await context.setProject(testDir);
      textEditor = await atom.workspace.open(
        nuclideUri.join(testDir, 'test.cpp'),
      );
    });
  });

  it('can refactor local variables and parameters', () => {
    waitsForFile('test.cpp');

    waitsFor('compilation to begin', 10000, () => {
      return busySignal.isBusy();
    });

    waitsFor('compilation to finish', 30000, () => {
      return !busySignal.isBusy();
    });

    runRename(textEditor, new Point(4, 22), 'varOne');
    runs(() => {
      expect(textEditor.getText()).toEqual(afterRenameOne);
      textEditor.save();
    });

    runRename(textEditor, new Point(13, 13), 'secondVarOne');
    runs(() => {
      expect(textEditor.getText()).toEqual(afterRenameTwo);
      textEditor.save();
    });

    runRename(textEditor, new Point(7, 25), 'varFour');
    runs(() => {
      expect(textEditor.getText()).toEqual(afterRenameThree);
      textEditor.save();
    });

    runRename(textEditor, new Point(4, 9), 'varTwo');
    runs(() => {
      expect(textEditor.getText()).toEqual(afterRenameFour);
      textEditor.save();
    });

    runRename(textEditor, new Point(6, 18), 'varFive');
    runs(() => {
      expect(textEditor.getText()).toEqual(afterRenameFive);
      textEditor.save();
    });

    runRename(textEditor, new Point(7, 18), 'varSix');
    runs(() => {
      expect(textEditor.getText()).toEqual(afterRenameSix);
      textEditor.save();
    });
  });
});

function runRename(
  textEditor: atom$TextEditor,
  point: atom$Point,
  newName: string,
): void {
  runs(() => {
    textEditor.setCursorBufferPosition(point);
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'nuclide-refactorizer:refactorize',
    );
  });
  waitsFor('refactor modal to appear', () => {
    // Wait for the refactoring ui to open
    return getRefactorHeaderElement() != null;
  });
  waitsFor('pick refactor element to appear', () => {
    return getPickElement() != null;
  });
  runs(() => {
    const pickRenameElement = getPickRenameElement();
    invariant(pickRenameElement != null);
    pickRenameElement.click();
  });
  waitsFor(() => {
    return getRenameTextEditor() != null;
  });
  runs(() => {
    const editor = getRenameTextEditor();
    invariant(editor != null);
    editor.setText(newName);

    const executeButton = getExecuteElement();
    invariant(executeButton != null);
    executeButton.click();
  });
  waitsFor(() => {
    // Wait for the refactoring ui to close
    return getRefactorHeaderElement() == null;
  });
}

function getRefactorHeaderElement(): ?HTMLElement {
  return document.querySelector('.nuclide-refactorizer-header');
}

function getPickElement(): ?HTMLElement {
  return document.querySelector('.nuclide-refactorizer-pick-refactor');
}

function getPickRenameElement(): ?HTMLElement {
  return document.querySelector('.nuclide-refactorizer-pick-rename');
}

function getRenameTextEditor(): ?atom$TextEditor {
  const element = document.querySelector('.nuclide-refactorizer-rename-editor');
  if (element == null) {
    return null;
  }
  return (element: any).getModel();
}

function getExecuteElement(): ?HTMLElement {
  return document.querySelector('.nuclide-refactorizer-execute-button');
}

const afterRenameOne = `struct CustomClass {};

#define RETURN(x) return x
int references_test(int varOne) {
  int var2 = varOne * varOne, var3;
  CustomClass var4;
  CustomClass &var5 = var4;
  CustomClass *var6 = &var4;

  references_test(++varOne + 1);
  varOne = var2 + 1;
  // A different var1!
  for (int var1 = 0; -var1 < 10; var1++) {
    RETURN(var1);
  }
  RETURN(varOne * varOne);
}
`;

const afterRenameTwo = `struct CustomClass {};

#define RETURN(x) return x
int references_test(int varOne) {
  int var2 = varOne * varOne, var3;
  CustomClass var4;
  CustomClass &var5 = var4;
  CustomClass *var6 = &var4;

  references_test(++varOne + 1);
  varOne = var2 + 1;
  // A different var1!
  for (int secondVarOne = 0; -secondVarOne < 10; secondVarOne++) {
    RETURN(secondVarOne);
  }
  RETURN(varOne * varOne);
}
`;

const afterRenameThree = `struct CustomClass {};

#define RETURN(x) return x
int references_test(int varOne) {
  int var2 = varOne * varOne, var3;
  CustomClass varFour;
  CustomClass &var5 = varFour;
  CustomClass *var6 = &varFour;

  references_test(++varOne + 1);
  varOne = var2 + 1;
  // A different var1!
  for (int secondVarOne = 0; -secondVarOne < 10; secondVarOne++) {
    RETURN(secondVarOne);
  }
  RETURN(varOne * varOne);
}
`;

const afterRenameFour = `struct CustomClass {};

#define RETURN(x) return x
int references_test(int varOne) {
  int varTwo = varOne * varOne, var3;
  CustomClass varFour;
  CustomClass &var5 = varFour;
  CustomClass *var6 = &varFour;

  references_test(++varOne + 1);
  varOne = varTwo + 1;
  // A different var1!
  for (int secondVarOne = 0; -secondVarOne < 10; secondVarOne++) {
    RETURN(secondVarOne);
  }
  RETURN(varOne * varOne);
}
`;

const afterRenameFive = `struct CustomClass {};

#define RETURN(x) return x
int references_test(int varOne) {
  int varTwo = varOne * varOne, var3;
  CustomClass varFour;
  CustomClass &varFive = varFour;
  CustomClass *var6 = &varFour;

  references_test(++varOne + 1);
  varOne = varTwo + 1;
  // A different var1!
  for (int secondVarOne = 0; -secondVarOne < 10; secondVarOne++) {
    RETURN(secondVarOne);
  }
  RETURN(varOne * varOne);
}
`;

const afterRenameSix = `struct CustomClass {};

#define RETURN(x) return x
int references_test(int varOne) {
  int varTwo = varOne * varOne, var3;
  CustomClass varFour;
  CustomClass &varFive = varFour;
  CustomClass *varSix = &varFour;

  references_test(++varOne + 1);
  varOne = varTwo + 1;
  // A different var1!
  for (int secondVarOne = 0; -secondVarOne < 10; secondVarOne++) {
    RETURN(secondVarOne);
  }
  RETURN(varOne * varOne);
}
`;
