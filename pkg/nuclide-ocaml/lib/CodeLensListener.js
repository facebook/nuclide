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

import type {AtomLanguageService} from '../../nuclide-language-service';
import type {
  LanguageService,
  CodeLensData,
} from '../../nuclide-language-service/lib/LanguageService';
import type {FileVersion} from '../../nuclide-open-files-rpc/lib/rpc-types';

import featureConfig from 'nuclide-commons-atom/feature-config';
import {observeEditorDestroy} from 'nuclide-commons-atom/text-editor';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {microtask} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';
import {getFileVersionOfEditor} from '../../nuclide-open-files';

const RETRIES = 3;
const MAX_LENS_LENGTH = 500;
const TRUNCATION_MESSAGE = '...\n(truncated, click to copy)';

type ResolvableLens = {
  lens: CodeLensData,
  element: HTMLElement,
  fullText: ?string,
  resolved: boolean,
  retries: number,
};

type ResolveInfo = {
  editor: atom$TextEditor,
  fileVersion: FileVersion,
  languageService: LanguageService,
  lenses: Array<ResolvableLens>,
};

function makeResolvableLens(
  editor: atom$TextEditor,
  markerLayer: atom$DisplayMarkerLayer,
  lens: CodeLensData,
): ResolvableLens {
  const marker = markerLayer.markBufferPosition(lens.range.start);
  const element = document.createElement('span');
  const lensInfo = {
    lens,
    element,
    fullText: null,
    marker,
    resolved: false,
    retries: 0,
  };

  element.classList.add('code-lens-content');

  // Put in a nonbreaking space to reserve the space in the editor. If
  // the space is already reserved, Atom won't have to scroll the
  // editor down as we resolve code lenses.
  element.innerHTML = '\xa0';
  const listener = () => {
    if (
      lensInfo.fullText != null &&
      featureConfig.get('nuclide-ocaml.codeLensCopy')
    ) {
      atom.clipboard.write(lensInfo.fullText);
      const tooltipDispose = atom.tooltips.add(element, {
        title: 'Copied code lens to clipboard.',
        placement: 'auto',
        trigger: 'manual',
      });
      setTimeout(() => tooltipDispose.dispose(), 3000);
    }
  };
  element.addEventListener('click', listener);
  marker.onDidDestroy(() => element.removeEventListener('click', listener));

  const leadingWhitespace = document.createElement('span');
  leadingWhitespace.innerText = ' '.repeat(lens.range.start.column);

  // We do a span inside a div so that the tooltip and clickable area
  // only cover the part of the code lens that has text, but the
  // code-lens style will be applied to the entire editor row.
  const containingElement = document.createElement('div');
  containingElement.classList.add('code-lens');
  containingElement.appendChild(leadingWhitespace);
  containingElement.appendChild(element);

  editor.decorateMarker(marker, {
    type: 'block',
    position: 'before',
    item: containingElement,
  });

  return lensInfo;
}

function getCodeLensPositions(
  atomLanguageService: AtomLanguageService<LanguageService>,
  logger: log4js$Logger,
  editor: atom$TextEditor,
): Observable<?{
  languageService: LanguageService,
  fileVersion: FileVersion,
  codeLens: Array<CodeLensData>,
}> {
  const uri = editor.getPath();
  return Observable.defer(() =>
    atomLanguageService.getLanguageServiceForUri(uri),
  ).switchMap(languageService => {
    if (languageService == null) {
      return Observable.of(null);
    }
    return Observable.defer(() => getFileVersionOfEditor(editor)).switchMap(
      fileVersion => {
        if (fileVersion == null) {
          return Observable.of(null);
        }
        return Observable.defer(async () => {
          const codeLens = await languageService.getCodeLens(fileVersion);
          if (codeLens == null) {
            throw new Error('Could not retrieve code lenses.');
          }
          return {languageService, fileVersion, codeLens};
        })
          .retryWhen(errs =>
            errs.zip(Observable.range(1, RETRIES)).flatMap((_, retryCount) => {
              return Observable.timer(retryCount * 1000);
            }),
          )
          .defaultIfEmpty(null);
      },
    );
  });
}

function markCodeLensPositions(
  languageService: LanguageService,
  editor: atom$TextEditor,
  markerLayer: atom$DisplayMarkerLayer,
  fileVersion: FileVersion,
  codeLens: Array<CodeLensData>,
): ResolveInfo {
  // Sort code lenses based on their row numbers from top to bottom, so
  // later their resolution can start in the same order.
  return {
    editor,
    fileVersion,
    languageService,
    lenses: codeLens
      .sort((lens1, lens2) => lens1.range.start.row - lens2.range.start.row)
      .map(lens => makeResolvableLens(editor, markerLayer, lens)),
  };
}

function resolveVisible(resolveInfo: ResolveInfo): Observable<?CodeLensData> {
  const editor = resolveInfo.editor;

  // Currently undocumented, but there's an open PR to add these to the public
  // API: https://github.com/atom/atom/issues/15559
  const firstLine = (editor: any).element.getFirstVisibleScreenRow();
  const lastLine = (editor: any).element.getLastVisibleScreenRow() + 1;

  const firstBufferLine = editor.bufferRowForScreenRow(firstLine);
  const lastBufferLine = editor.bufferRowForScreenRow(lastLine);

  // If this begins to become a performance concern we can sort the list and
  // then do a binary search to find the starting and ending range, but in
  // practice I've observed that it's rare for a file to have more than a few
  // dozen (few hundred for large files) code lenses, and the weight of
  // going over the network and resolving the code lenses is several orders of
  // magnitude more than looping over a small array and doing simple numerical
  // comparisons.
  const resolvableLenses = resolveInfo.lenses.filter(
    lensInfo =>
      lensInfo.lens.range.start.row >= firstBufferLine &&
      lensInfo.lens.range.start.row <= lastBufferLine,
  );

  return Observable.from(resolvableLenses).mergeMap(lensInfo => {
    const isFolded = () =>
      editor.isFoldedAtBufferRow(lensInfo.lens.range.start.row);
    return Observable.defer(() => {
      if (lensInfo.resolved || isFolded()) {
        return Promise.resolve(lensInfo.lens);
      }

      // Set this *before* we get the data so we don't send duplicate requests.
      lensInfo.resolved = true;
      return resolveInfo.languageService.resolveCodeLens(
        resolveInfo.fileVersion.filePath,
        lensInfo.lens,
      );
    }).do((lens: ?CodeLensData) => {
      lensInfo.element.classList.toggle('folded', isFolded());

      if (!lensInfo.resolved) {
        // We skipped this one because it was folded.
        return;
      }

      if (lens != null && lens.command != null) {
        lensInfo.fullText = lens.command.title;
        let text = lensInfo.fullText;
        if (text.length > MAX_LENS_LENGTH) {
          text =
            text.substr(0, MAX_LENS_LENGTH - TRUNCATION_MESSAGE.length) +
            TRUNCATION_MESSAGE;
        }

        if (!featureConfig.get('nuclide-ocaml.codeLensMultiLine')) {
          text = text.replace(/\s/gm, ' ');
        }

        lensInfo.element.innerText = text;
      } else if (lensInfo.retries < RETRIES) {
        lensInfo.resolved = false;
        lensInfo.retries++;
      }
    });
  });
}

export function observeForCodeLens(
  atomLanguageService: AtomLanguageService<LanguageService>,
  logger: log4js$Logger,
): IDisposable {
  return new UniversalDisposable(
    observableFromSubscribeFunction(
      atom.workspace.observeTextEditors.bind(atom.workspace),
    )
      // If the editor is already open when the user launches Atom, then *two*
      // events will be fired from observeTextEditors, so group by the editor ID
      // and then only take the first in order to avoid the second event.
      // The cause for this is:
      //  1. Atom loads the text editor and adds it to the registry
      //  2. Atom loads the grammar and then loads the OCaml package (because it
      //     only activates when an OCaml file is opened). At this point it's
      //     able to get the list of editors, and it fires observeTextEditors.
      //  3. did-add-text-editor is fired, causing the duplicated event.
      // TODO(wipi): remove once https://github.com/atom/atom/pull/17299 is
      // released.
      .distinct(editor => editor.id)
      .mergeMap(editor => {
        const markerLayer = editor.addMarkerLayer();
        return (
          observableFromSubscribeFunction(editor.onDidSave.bind(editor))
            // Add an additional event into the stream so that we don't need to
            // save the file in order to get the first set of code lenses.
            .startWith(null)
            .switchMap(evt =>
              getCodeLensPositions(atomLanguageService, logger, editor),
            )
            .do(() => markerLayer.clear())
            .filter(Boolean)
            .map(positions =>
              markCodeLensPositions(
                positions.languageService,
                editor,
                markerLayer,
                positions.fileVersion,
                positions.codeLens,
              ),
            )
            .switchMap((resolveInfo, iteration) =>
              Observable.merge(
                iteration === 0
                  ? microtask.do(() => {
                      editor.scrollToCursorPosition({center: true});
                    })
                  : Observable.empty(),
                Observable.timer(0, 1000).concatMap(() =>
                  resolveVisible(resolveInfo),
                ),
              ),
            )
            .takeUntil(observeEditorDestroy(editor))
        );
      })
      .subscribe(),
  );
}
