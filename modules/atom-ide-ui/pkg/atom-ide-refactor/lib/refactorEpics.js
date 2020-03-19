/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {ActionsObservable, Epic} from 'nuclide-commons/redux-observable';
import type ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import {getFileForPath} from 'nuclide-commons-atom/projects';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {
  ApplyAction,
  RefactorAction,
  RefactorState,
  ExecuteAction,
} from './types';
import type {ExternalTextEdit, RefactorEditResponse} from './types';
import type {RefactorProvider} from './types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import invariant from 'assert';
import {arrayFlatten} from 'nuclide-commons/collection';
import {Observable} from 'rxjs';
import {Range, TextBuffer} from 'atom';

import nuclideUri from 'nuclide-commons/nuclideUri';
import parse from 'diffparser';
import nullthrows from 'nullthrows';
import {applyTextEditsToBuffer} from 'nuclide-commons-atom/text-edit';
import {toUnifiedDiff} from 'nuclide-commons-atom/text-edit-diff';
import {existingEditorForUri} from 'nuclide-commons-atom/text-editor';
import {getLogger} from 'log4js';
import analytics from 'nuclide-commons/analytics';

import * as Actions from './refactorActions';

export function getEpics(
  providers: ProviderRegistry<RefactorProvider>,
): Array<Epic<RefactorAction, RefactorState, void>> {
  return [
    function getRefactoringsEpic(
      actions: ActionsObservable<RefactorAction>,
    ): Observable<RefactorAction> {
      return actions.ofType('open').switchMap(() => {
        return Observable.fromPromise(getRefactorings(providers)).takeUntil(
          actions,
        );
      });
    },

    function executeRefactoringEpic(
      actions: ActionsObservable<RefactorAction>,
    ): Observable<RefactorAction> {
      return actions.ofType('execute').switchMap(action => {
        // Flow doesn't understand the implications of ofType :(
        invariant(action.type === 'execute');
        return executeRefactoring(action)
          .concat(
            // Default handler if we don't get a result.
            Observable.of(
              Actions.error('execute', Error('Could not refactor.')),
            ),
          )
          .takeUntil(actions.filter(x => x.type !== 'progress'));
      });
    },

    function applyRefactoringEpic(
      actions: ActionsObservable<RefactorAction>,
    ): Observable<RefactorAction> {
      return actions.ofType('apply').switchMap(action => {
        invariant(action.type === 'apply');
        return applyRefactoring(action).takeUntil(actions.ofType('close'));
      });
    },

    function loadDiffPreviewEpic(
      actions: ActionsObservable<RefactorAction>,
    ): Observable<RefactorAction> {
      return actions.ofType('load-diff-preview').switchMap(action => {
        invariant(action.type === 'load-diff-preview');
        return Observable.fromPromise(
          loadDiffPreview(action.payload.uri, action.payload.response),
        );
      });
    },

    function handleErrors(
      actions: ActionsObservable<RefactorAction>,
    ): Observable<RefactorAction> {
      return actions.ofType('error').map(action => {
        invariant(action.type === 'error');
        const {source, error} = action.payload;
        const sourceName =
          source === 'got-refactorings'
            ? 'getting refactors'
            : 'executing refactor';
        getLogger('nuclide-refactorizer').error(`Error ${sourceName}:`, error);
        atom.notifications.addError(`Error ${sourceName}`, {
          description: error.message,
          dismissable: true,
        });
        return Actions.close();
      });
    },
  ];
}

async function getRefactorings(
  registry: ProviderRegistry<RefactorProvider>,
): Promise<RefactorAction> {
  analytics.track('nuclide-refactorizer:get-refactorings');
  const editor = atom.workspace.getActiveTextEditor();
  if (editor == null || editor.getPath() == null) {
    return Actions.error(
      'get-refactorings',
      Error('Must be run from a saved file.'),
    );
  }
  try {
    const selectedRange = editor.getSelectedBufferRange();

    const providers = Array.from(
      registry.getAllProvidersForEditor(editor),
    ).filter(p => p.refactorings != null);

    if (providers.length === 0) {
      return Actions.error('get-refactorings', Error('No providers found.'));
    }

    const availableRefactorings = arrayFlatten(
      await Promise.all(
        providers.map(p => nullthrows(p.refactorings)(editor, selectedRange)),
      ),
    );
    availableRefactorings.sort(
      (x, y) => (x.disabled === true ? 1 : 0) - (y.disabled === true ? 1 : 0),
    );
    return Actions.gotRefactorings(
      editor,
      selectedRange,
      providers,
      availableRefactorings,
    );
  } catch (e) {
    return Actions.error('get-refactorings', e);
  }
}

function executeRefactoring(action: ExecuteAction): Observable<RefactorAction> {
  const {refactoring, providers} = action.payload;
  const refactorProviders = providers.filter(p => p.refactor != null);
  const renameProviders = providers.filter(p => p.rename != null);
  if (refactoring.kind === 'freeform' && refactorProviders.length > 0) {
    return Observable.from(refactorProviders)
      .mergeMap(p => nullthrows(p.refactor)(refactoring))
      .map(response => {
        switch (response.type) {
          case 'progress':
            return Actions.progress(
              response.message,
              response.value,
              response.max,
            );
          case 'edit':
          case 'external-edit':
          case 'rename-external-edit':
            if (response.edits.size <= 1) {
              return Actions.apply(response);
            }
            return Actions.confirm(response);
          default:
            (response: empty);
            throw new Error();
        }
      })
      .catch(e => Observable.of(Actions.error('execute', e)));
  } else if (refactoring.kind === 'rename' && renameProviders.length > 0) {
    const {editor, position, newName} = refactoring;

    return Observable.fromPromise(
      Promise.all(
        renameProviders.map(p =>
          nullthrows(p.rename)(editor, position, newName),
        ),
      ),
    )
      .map(allEdits => {
        const renameResult = allEdits.find(e => e != null);

        if (renameResult != null && renameResult.type === 'error') {
          return Actions.error('execute', Error(renameResult.message));
        } else if (renameResult == null || renameResult.data.size === 0) {
          return Actions.close();
        }

        const edits = renameResult.data;

        const currentFilePath = editor.getPath();
        invariant(currentFilePath != null);

        // If the map only has 1 key (a single unique NuclideURI) and it matches the
        //  currently opened file, then all the TextEdits must be local.
        let response;
        if (edits.size === 1 && edits.keys().next().value === currentFilePath) {
          response = {
            type: 'edit',
            edits,
          };
          return Actions.apply(response);
        } else {
          response = {
            type: 'rename-external-edit',
            edits,
          };
          return Actions.confirm(response);
        }
      })
      .catch(e => Observable.of(Actions.error('execute', e)));
  } else {
    return Observable.of(
      Actions.error('execute', Error('No appropriate provider found.')),
    );
  }
}

// This offers two different options for applying edits:
//  1. Apply changes to open files only without saving
//  2. Apply changes to all files, open or unopened, directly to disk.
// In both cases, the format of the edits are the same (TextEdits)
const FILE_IO_CONCURRENCY = 4;

export function applyRefactoring(
  action: ApplyAction,
): Observable<RefactorAction> {
  return Observable.defer(() => {
    const {response} = action.payload;
    let editStream = Observable.empty();
    if (response.type === 'edit') {
      // Regular edits are applied directly to open buffers.
      // Note that all files must actually be open.
      for (const [path, edits] of response.edits) {
        const editor = existingEditorForUri(path);
        if (editor != null) {
          applyTextEditsToBuffer(editor.getBuffer(), edits);
        } else {
          return Observable.of(
            Actions.error(
              'execute',
              Error(`Local Rename: Expected file ${path} to be open.`),
            ),
          );
        }
      }
    } else {
      // NOTE: Flow is unable to associate the type of the response with the
      //        type of the edit. In order to give it this information, we had
      //        no choice but to be SUPER hacky and assign a type to each edit.
      let typedEdits;
      switch (response.type) {
        case 'external-edit':
          typedEdits = Array.from(response.edits.entries()).map(
            ([path, edits]) => [
              path,
              edits.map(edit => {
                return {
                  type: 'external-edit',
                  edit,
                };
              }),
            ],
          );
          break;
        case 'rename-external-edit':
          typedEdits = Array.from(response.edits.entries()).map(
            ([path, edits]) => [
              path,
              edits.map(edit => {
                return {
                  type: 'rename-external-edit',
                  edit,
                };
              }),
            ],
          );
          break;
        default:
          throw new Error(`Unhandled response type: ${response.type}`);
      }

      // External text edits are converted into absolute character offsets
      //  and applied directly to disk.
      editStream = Observable.from(typedEdits)
        .mergeMap(async ([path, textEdits]) => {
          const file = getFileForPath(path);
          if (file == null) {
            throw new Error(`Could not read file ${path}`);
          }
          let data = await file.read();
          const buffer = new TextBuffer(data);

          const edits = textEdits.map(textEdit => {
            switch (textEdit.type) {
              case 'rename-external-edit':
                return toAbsoluteCharacterOffsets(buffer, textEdit.edit);
              case 'external-edit':
                return textEdit.edit;
              default:
                throw new Error(`Unhandled response type: ${response.type}`);
            }
          });

          edits.sort((a, b) => a.startOffset - b.startOffset);
          edits.reverse().forEach(edit => {
            if (edit.oldText != null) {
              const oldText = data.substring(edit.startOffset, edit.endOffset);
              if (oldText !== edit.oldText) {
                throw new Error(
                  `Cannot apply refactor: file contents of ${path} have changed!`,
                );
              }
            }
            data =
              data.slice(0, edit.startOffset) +
              edit.newText +
              data.slice(edit.endOffset);
          });
          await file.write(data);
        }, FILE_IO_CONCURRENCY)
        .scan((done, _) => done + 1, 0)
        .startWith(0)
        .map(done =>
          Actions.progress('Applying edits...', done, response.edits.size),
        );
    }
    return Observable.concat(
      editStream,
      Observable.of(Actions.close()).do(() =>
        analytics.track('nuclide-refactorizer:success'),
      ),
    );
  });
}

async function loadDiffPreview(
  uri: NuclideUri,
  response: RefactorEditResponse,
): Promise<RefactorAction> {
  const file = getFileForPath(uri);
  if (file == null) {
    throw new Error(`Could not read file ${uri}`);
  }
  const buffer = new TextBuffer(await file.read());
  const edits = getEdits(uri, buffer, response);
  const diffString = toUnifiedDiff(nuclideUri.basename(uri), buffer, edits);

  return Actions.displayDiffPreview(parse(diffString));
}

function getEdits(
  uri: NuclideUri,
  buffer: atom$TextBuffer,
  response: RefactorEditResponse,
): Array<TextEdit> {
  switch (response.type) {
    case 'edit':
    case 'rename-external-edit':
      return response.edits.get(uri) || [];
    case 'external-edit':
      return (response.edits.get(uri) || []).map(e => toTextEdit(buffer, e));
    default:
      return [];
  }
}

function toTextEdit(buffer: atom$TextBuffer, edit: ExternalTextEdit): TextEdit {
  return {
    oldRange: new Range(
      buffer.positionForCharacterIndex(edit.startOffset),
      buffer.positionForCharacterIndex(edit.endOffset),
    ),
    oldText: edit.oldText,
    newText: edit.newText,
  };
}

function toAbsoluteCharacterOffsets(
  buffer: atom$TextBuffer,
  edit: TextEdit,
): ExternalTextEdit {
  const startingPoint = edit.oldRange.start;
  const endingPoint = edit.oldRange.end;

  return {
    startOffset: buffer.characterIndexForPosition(startingPoint),
    endOffset: buffer.characterIndexForPosition(endingPoint),
    newText: edit.newText,
    oldText: edit.oldText,
  };
}
