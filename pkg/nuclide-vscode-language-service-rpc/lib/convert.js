/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {TokenizedText} from 'nuclide-commons/tokenized-text';
import type {
  Definition,
  DiagnosticMessageType,
  DiagnosticTrace,
  Reference,
  CodeAction,
  SignatureHelp,
} from 'atom-ide-ui';
import type {
  Diagnostic,
  PublishDiagnosticsParams,
  RelatedLocation,
  CodeLens,
  FileEvent,
  LocationWithTitle,
  ShowStatusParams,
} from './protocol';
import type {
  Completion,
  FileDiagnosticMap,
  FileDiagnosticMessage,
  SymbolResult,
  CodeLensData,
  StatusData,
} from '../../nuclide-language-service/lib/LanguageService';
import type {FileChange} from 'nuclide-watchman-helpers';
import type {ShowNotificationLevel} from '../../nuclide-language-service-rpc/lib/rpc-types';
import type {
  TextDocumentIdentifier,
  Position,
  Range,
  Location,
  CompletionItem,
  TextDocumentPositionParams,
  SymbolInformation,
  Command,
  SignatureHelp as LspSignatureHelpType,
} from './protocol';
import type {
  TextEdit as LspTextEditType,
  WorkspaceEdit as WorkspaceEditType,
  TextDocumentEdit as TextDocumentEditType,
} from './protocol';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {Point, Range as atom$Range} from 'simple-text-buffer';
import {
  CompletionItemKind,
  DiagnosticSeverity,
  InsertTextFormat,
  SymbolKind,
  MessageType as LspMessageType,
  FileChangeType,
} from './protocol';
import {
  className,
  method,
  constructor,
  string,
  plain,
} from 'nuclide-commons/tokenized-text';
import {arrayCompact} from 'nuclide-commons/collection';

export function localPath_lspUri(filepath: NuclideUri): string {
  // NuclideUris are either a local file path, or nuclide://<host><path>.
  // LSP URIs are always file://
  if (!nuclideUri.isLocal(filepath)) {
    throw new Error(`Expected a local filepath, not ${filepath}`);
  } else {
    return nuclideUri.nuclideUriToUri(filepath);
  }
}

export function lspUri_localPath(uri: string): NuclideUri {
  // We accept LSP file:// URIs, and also plain paths for back-compat
  // We return a local path.
  const path = nuclideUri.uriToNuclideUri(uri);
  if (path == null || !nuclideUri.isLocal(path)) {
    throw new Error(`LSP returned an invalid URI ${uri}`);
  } else {
    return path;
  }
}

export function lspTextEdits_atomTextEdits(
  edits: Array<LspTextEditType>,
): Array<TextEdit> {
  return edits.map(lspTextEdit => {
    const oldRange = lspRange_atomRange(lspTextEdit.range);
    return {
      oldRange,
      newText: lspTextEdit.newText,
    };
  });
}

//    WorkspaceEdits can either provide `changes` (a mapping of document URIs to their TextEdits)
//        or `documentChanges` (an array of TextDocumentEdits where
//        each text document edit addresses a specific version of a text document).
//
//    TODO: Compare the versions of the documents being edited with
//            the version numbers contained within `documentChanges`.
//          Right now, we use `documentChanges` while ignoring version numbers.
export function lspWorkspaceEdit_atomWorkspaceEdit(
  lspWorkspaceEdit: WorkspaceEditType,
): Map<NuclideUri, Array<TextEdit>> {
  const workspaceEdit = new Map();
  const lspChanges = lspWorkspaceEdit.changes;
  const lspDocChanges = lspWorkspaceEdit.documentChanges;

  if (lspChanges != null) {
    Object.keys(lspChanges).forEach((lspUri: string) => {
      const path = lspUri_localPath(lspUri);
      const textEdits = lspTextEdits_atomTextEdits(lspChanges[lspUri]);

      workspaceEdit.set(path, textEdits);
    });
  } else if (lspDocChanges != null) {
    lspDocChanges.forEach((textDocumentEdit: TextDocumentEditType) => {
      const lspUri = textDocumentEdit.textDocument.uri;
      const lspTextEdits = textDocumentEdit.edits;

      const path = lspUri_localPath(lspUri);
      const textEdits = lspTextEdits_atomTextEdits(lspTextEdits);

      workspaceEdit.set(path, textEdits);
    });
  }

  return workspaceEdit;
}

export function lspLocation_atomFoundReference(location: Location): Reference {
  return {
    uri: lspUri_localPath(location.uri),
    // although called a "uri" its really a string used for grouping.
    name: null,
    range: lspRange_atomRange(location.range),
  };
}

export function lspLocationWithTitle_atomDefinition(
  location: LocationWithTitle,
  projectRoot: NuclideUri,
): Definition {
  return {
    path: lspUri_localPath(location.uri),
    position: lspPosition_atomPoint(location.range.start),
    language: 'lsp', // pointless; only ever used to judge equality of two defs
    projectRoot, // used to relativize paths when showing multiple targets
    name: location.title == null ? undefined : location.title, // nuclide-only
  };
}

export function localPath_lspTextDocumentIdentifier(
  filePath: NuclideUri,
): TextDocumentIdentifier {
  return {
    uri: localPath_lspUri(filePath),
  };
}

export function atomPoint_lspPosition(position: atom$Point): Position {
  return {
    line: position.row,
    character: position.column,
  };
}

export function lspPosition_atomPoint(position: Position): atom$Point {
  return new Point(position.line, position.character);
}

export function lspRange_atomRange(range: Range): atom$Range {
  return new atom$Range(
    lspPosition_atomPoint(range.start),
    lspPosition_atomPoint(range.end),
  );
}

export function atomRange_lspRange(range: atom$Range): Range {
  return {
    start: atomPoint_lspPosition(range.start),
    end: atomPoint_lspPosition(range.end),
  };
}

export function atom_lspPositionParams(
  filePath: string,
  point: atom$Point,
): TextDocumentPositionParams {
  return {
    textDocument: localPath_lspTextDocumentIdentifier(filePath),
    position: atomPoint_lspPosition(point),
  };
}

export function lspCompletionItemKind_atomCompletionType(
  kind: ?number,
): ?string {
  switch (kind) {
    case CompletionItemKind.Text:
      return '';
    case CompletionItemKind.Method:
      return 'method';
    case CompletionItemKind.Function:
      return 'function';
    case CompletionItemKind.Constructor:
      return 'function'; // Not an exact match, but the best we can do
    case CompletionItemKind.Field:
      return 'property';
    case CompletionItemKind.Variable:
      return 'variable';
    case CompletionItemKind.Class:
      return 'class';
    case CompletionItemKind.Interface:
      return 'type';
    case CompletionItemKind.Module: // see .Module, .File, .Unit, .Reference
      return 'import';
    case CompletionItemKind.Property:
      return 'property';
    case CompletionItemKind.Unit:
      return 'require';
    case CompletionItemKind.Value:
      return 'value';
    case CompletionItemKind.Enum:
      return 'constant'; // closest we can do. Alternative is 'tag'
    case CompletionItemKind.Keyword:
      return 'keyword';
    case CompletionItemKind.Snippet:
      return 'snippet';
    case CompletionItemKind.Color:
      return 'constant'; // closest we can do.
    case CompletionItemKind.File:
      return 'require';
    case CompletionItemKind.Reference:
      return 'require';
    default:
      return null;
  }
}

export function lspCompletionItemKind_atomIcon(kind: ?number): ?string {
  // returns null if there should be no icon
  // returns 'DEFAULT' for the default icon provided by AutocompletePlus
  // returns anything else for an Atom icon

  // Unfortunately, LSP doesn't yet have CompletionItemKinds for all the
  // possible SymbolKinds (e.g. CompletionItemKind is missing namespace).
  // So LSP servers will presumably be returning an alternative, e.g. maybe
  // CompletionItemKind.Module for their namespaces.
  // https://github.com/Microsoft/language-server-protocol/issues/155

  // Unfortunately, Atom only provides a thematically unified 'type-*' icon set
  // for SymbolKind icons (e.g. it has no icon for Value or Keyword).
  // In such cases we try to fall back to the icons provided by AutocompletePlus
  switch (kind) {
    case null:
      return null;
    case CompletionItemKind.Text:
      return null; // no Atom icon, and no good AutocompletePlus fallback
    case CompletionItemKind.Method:
      return 'type-method';
    case CompletionItemKind.Function:
      return 'type-function';
    case CompletionItemKind.Constructor:
      return 'type-constructor';
    case CompletionItemKind.Field:
      return 'type-field';
    case CompletionItemKind.Variable:
      return 'type-variable';
    case CompletionItemKind.Class:
      return 'type-class';
    case CompletionItemKind.Interface:
      return 'type-interface';
    case CompletionItemKind.Module:
      return 'type-module';
    case CompletionItemKind.Property:
      return 'type-property';
    case CompletionItemKind.Unit:
      return null; // not even sure what this is supposed to be
    case CompletionItemKind.Value:
      return 'DEFAULT'; // this has a good fallback in AutocompletePlus
    case CompletionItemKind.Enum:
      return 'type-enum';
    case CompletionItemKind.Keyword:
      return 'DEFAULT'; // this has a good fallback in AutocompletePlus
    case CompletionItemKind.Snippet:
      return 'DEFAULT'; // this has a good fallback in AutocompletePlus
    case CompletionItemKind.Color:
      return null; // no Atom icon, and no suitable fallback in AutocompletePlus
    case CompletionItemKind.File:
      return 'type-file';
    case CompletionItemKind.Reference:
      return null; // not even sure what this is supposed to be
    default:
      return null;
  }
}

export function lspCompletionItem_atomCompletion(
  item: CompletionItem,
  supportsResolve: boolean,
): Completion {
  const useSnippet = item.insertTextFormat === InsertTextFormat.Snippet;
  const lspTextEdits = getCompletionTextEdits(item);
  const icon = lspCompletionItemKind_atomIcon(item.kind);
  let iconHTML;
  if (icon == null) {
    iconHTML = ''; // no icon at all
  } else if (icon === 'DEFAULT') {
    iconHTML = undefined; // fall through to the default AutocompletePlus icon
  } else {
    iconHTML = `<span class="icon-${icon}"></span>`;
  }

  const descriptionItems = [];
  if (item.detail != null && item.detail !== '') {
    descriptionItems.push(item.detail);
  }

  let descriptionMarkdown;
  const documentation = item.documentation;
  if (typeof documentation === 'string') {
    descriptionItems.push(documentation);
  } else if (documentation != null) {
    // documentation is a MarkupContent.
    descriptionMarkdown = documentation.value;
  }

  return {
    // LSP: label is what should be displayed in the autocomplete list
    // Atom: displayText is what's displayed
    displayText: item.label,
    // LSP: if insertText is present, insert that, else fall back to label
    // LSP: insertTextFormat says whether we're inserting text or snippet
    // Atom: text/snippet: one of them has to be defined
    // flowlint-next-line sketchy-null-string:off
    snippet: useSnippet ? item.insertText || item.label : undefined,
    // flowlint-next-line sketchy-null-string:off
    text: useSnippet ? undefined : item.insertText || item.label,
    rightLabel: item.detail,
    // LSP: kind indicates what icon should be used
    // ATOM: type is to indicate icon and its background color
    // ATOM: iconHTML can be used to override the icon
    type: lspCompletionItemKind_atomCompletionType(item.kind),
    iconHTML,
    // LSP: create from detail (signature) and documentation (doc block)
    // Atom: description is displayed in the footer of the autocomplete tab
    description: descriptionItems.join('\n\n'),
    descriptionMarkdown,
    textEdits:
      lspTextEdits != null
        ? lspTextEdits_atomTextEdits(lspTextEdits)
        : undefined,
    // Resolving a completion item in the LSP requires passing in the original
    // completion item, and since completion items are sent over the wire we
    // already know they're serializable to JSON.
    extraData: supportsResolve ? JSON.stringify(item) : undefined,
    // LSP and Nuclide extension: string used to filter a set of completion items
    filterText: item.filterText,
    // LSP and Nuclide extension: string used to compare a completion item to another
    sortText: item.sortText,
  };
}

function getCompletionTextEdits(item: CompletionItem): ?Array<LspTextEditType> {
  if (item.textEdit != null) {
    if (item.additionalTextEdits != null) {
      return [item.textEdit, ...item.additionalTextEdits];
    } else {
      return [item.textEdit];
    }
  }
  return null;
}

export function lspMessageType_atomShowNotificationLevel(
  type: number,
): ShowNotificationLevel {
  switch (type) {
    case LspMessageType.Info:
      return 'info';
    case LspMessageType.Warning:
      return 'warning';
    case LspMessageType.Log:
      return 'log';
    case LspMessageType.Error:
      return 'error';
    default:
      return 'error';
  }
}

export function lspSymbolKind_atomIcon(kind: number): string {
  // Atom icons: https://github.com/atom/atom/blob/master/static/octicons.less
  // You can see the pictures at https://octicons.github.com/
  // for reference, vscode: https://github.com/Microsoft/vscode/blob/be08f9f3a1010354ae2d8b84af017ed1043570e7/src/vs/editor/contrib/suggest/browser/media/suggest.css#L135
  // for reference, hack: https://github.com/facebook/nuclide/blob/20cf17dca439e02a64f4365f3a52b0f26cf53726/pkg/nuclide-hack-rpc/lib/SymbolSearch.js#L120
  switch (kind) {
    case SymbolKind.File:
      return 'type-file';
    case SymbolKind.Module:
      return 'type-module';
    case SymbolKind.Namespace:
      return 'type-namespace';
    case SymbolKind.Package:
      return 'type-package';
    case SymbolKind.Class:
    case SymbolKind.Struct:
      return 'type-class';
    case SymbolKind.Method:
      return 'type-method';
    case SymbolKind.Property:
    case SymbolKind.Key:
      return 'type-property';
    case SymbolKind.Field:
    case SymbolKind.EnumMember:
      return 'type-field';
    case SymbolKind.Constructor:
      return 'type-constructor';
    case SymbolKind.Enum:
      return 'type-enum';
    case SymbolKind.Interface:
      return 'type-interface';
    case SymbolKind.Function:
    case SymbolKind.Operator:
      return 'type-function';
    case SymbolKind.Variable:
    case SymbolKind.Object:
      return 'type-variable';
    case SymbolKind.Constant:
      return 'type-constant';
    case SymbolKind.String:
      return 'type-string';
    case SymbolKind.Number:
      return 'type-number';
    case SymbolKind.Boolean:
      return 'type-boolean';
    case SymbolKind.Array:
      return 'type-array';
    case SymbolKind.Null:
      // Empty string to display no icon.
      return '';
    case SymbolKind.Event:
      return 'octicon-pulse';
    case SymbolKind.TypeParameter:
      return 'octicon-code';
    default:
      return 'question';
  }
}

// Converts an LSP SymbolInformation into TokenizedText
export function lspSymbolInformation_atomTokenizedText(
  symbol: SymbolInformation,
): TokenizedText {
  const tokens = [];

  // The TokenizedText ontology is deliberately small, much smaller than
  // SymbolInformation.kind, because it's used for colorization and you don't
  // want your colorized text looking like a fruit salad.
  switch (symbol.kind) {
    case SymbolKind.File:
    case SymbolKind.Module:
    case SymbolKind.Package:
    case SymbolKind.Namespace:
      tokens.push(plain(symbol.name));
      break;
    case SymbolKind.Class:
    case SymbolKind.Interface:
      tokens.push(className(symbol.name));
      break;
    case SymbolKind.Constructor:
      tokens.push(constructor(symbol.name));
      break;
    case SymbolKind.Method:
    case SymbolKind.Property:
    case SymbolKind.Field:
    case SymbolKind.Enum:
    case SymbolKind.Function:
    case SymbolKind.Constant:
    case SymbolKind.Variable:
    case SymbolKind.Array:
      tokens.push(method(symbol.name));
      break;
    case SymbolKind.String:
    case SymbolKind.Number:
    case SymbolKind.Boolean:
      tokens.push(string(symbol.name));
      break;
    default:
      tokens.push(plain(symbol.name));
  }

  return tokens;
}

export function lspSymbolInformation_atomSymbolResult(
  info: SymbolInformation,
): SymbolResult {
  let hoverText = 'unknown';
  for (const key in SymbolKind) {
    if (info.kind === SymbolKind[key]) {
      hoverText = key;
    }
  }
  return {
    resultType: 'SYMBOL',
    path: lspUri_localPath(info.location.uri),
    line: info.location.range.start.line,
    column: info.location.range.start.character,
    name: info.name,
    containerName: info.containerName,
    icon: lspSymbolKind_atomIcon(info.kind),
    hoverText,
  };
}

function lspSeverity_atomDiagnosticMessageType(
  severity?: number,
): DiagnosticMessageType {
  switch (severity) {
    case null:
    case undefined:
    case DiagnosticSeverity.Error:
    default:
      return 'Error';
    case DiagnosticSeverity.Warning:
      return 'Warning';
    case DiagnosticSeverity.Information:
      return 'Info';
    case DiagnosticSeverity.Hint:
      return 'Hint';
  }
}

function atomDiagnosticMessageType_lspSeverity(
  diagnosticType: DiagnosticMessageType,
): number {
  switch (diagnosticType) {
    case 'Error':
      return DiagnosticSeverity.Error;
    case 'Warning':
      return DiagnosticSeverity.Warning;
    case 'Info':
      return DiagnosticSeverity.Information;
    case 'Hint':
      return DiagnosticSeverity.Hint;
    default:
      (diagnosticType: empty); // Will cause a Flow error if a new DiagnosticSeverity value is added.
      throw new Error('Unsupported DiagnosticMessageType');
  }
}

function lspRelatedLocation_atomTrace(
  related: RelatedLocation,
): DiagnosticTrace {
  return {
    type: 'Trace',
    text: related.message,
    filePath: lspUri_localPath(related.location.uri),
    range: lspRange_atomRange(related.location.range),
  };
}

/**
 * Converts an Atom Trace to an Lsp RelatedLocation. A RelatedLocation requires a
 * range. Therefore, this will return null when called with an Atom Trace that
 * does not have a range.
 */
function atomTrace_lspRelatedLocation(
  trace: DiagnosticTrace,
): ?RelatedLocation {
  const {range, text, filePath} = trace;
  if (range != null) {
    return {
      message: text || '',
      location: {
        uri: localPath_lspUri(filePath || ''),
        range: atomRange_lspRange(range),
      },
    };
  }
  return null;
}

function lspDiagnostic_atomDiagnostic(
  diagnostic: Diagnostic,
  filePath: NuclideUri, // has already been converted for us
  defaultSource: string,
): FileDiagnosticMessage {
  const atomDiagnostic: FileDiagnosticMessage = {
    providerName: diagnostic.source != null ? diagnostic.source : defaultSource,
    type: lspSeverity_atomDiagnosticMessageType(diagnostic.severity),
    filePath,
    text: diagnostic.message,
    range: lspRange_atomRange(diagnostic.range),
    trace: (diagnostic.relatedLocations || []).map(
      lspRelatedLocation_atomTrace,
    ),
  };
  if (diagnostic.code != null) {
    atomDiagnostic.providerName += ': ' + String(diagnostic.code);
    atomDiagnostic.code = parseInt(String(diagnostic.code), 10);
  }
  if (diagnostic.stale != null) {
    atomDiagnostic.stale = diagnostic.stale;
  }
  return atomDiagnostic;
}

export function lspCommand_atomCodeAction(
  command: Command,
  applyFunc: () => Promise<void>,
): CodeAction {
  return {
    getTitle: () => {
      return Promise.resolve(command.title);
    },
    apply: applyFunc,
    dispose: () => {},
  };
}

/**
 * Converts an Atom FileMessageDiagnostic to an LSP Diagnostic. LSP diagnostics
 * require a range, while they are currently optional for Atom Diangostics. Therefore,
 * this will return null when called with an Atom Diagnostic without a range.
 */
export function atomDiagnostic_lspDiagnostic(
  diagnostic: FileDiagnosticMessage,
): ?Diagnostic {
  if (diagnostic.range != null) {
    const lspDiagnostic: Diagnostic = {
      range: atomRange_lspRange(diagnostic.range),
      severity: atomDiagnosticMessageType_lspSeverity(diagnostic.type),
      source: diagnostic.providerName,
      message: diagnostic.text || '',
      relatedLocations: arrayCompact(
        (diagnostic.trace || []).map(atomTrace_lspRelatedLocation),
      ),
    };
    if (diagnostic.code != null) {
      lspDiagnostic.code = diagnostic.code;
    }
    if (diagnostic.stale != null) {
      lspDiagnostic.stale = diagnostic.stale;
    }
    return lspDiagnostic;
  }
  return null;
}

export function lspDiagnostics_atomDiagnostics(
  params: PublishDiagnosticsParams,
  defaultSource: string,
): FileDiagnosticMap {
  const filePath = lspUri_localPath(params.uri);
  return new Map([
    [
      filePath,
      params.diagnostics.map(d =>
        lspDiagnostic_atomDiagnostic(d, filePath, defaultSource),
      ),
    ],
  ]);
}

export function codeLensData_lspCodeLens(codeLensData: CodeLensData): CodeLens {
  return {
    range: {
      start: {
        line: codeLensData.range.start.row,
        character: codeLensData.range.start.column,
      },
      end: {
        line: codeLensData.range.end.row,
        character: codeLensData.range.end.column,
      },
    },
    command: codeLensData.command,
    data: codeLensData.data,
  };
}

export function lspCodeLens_codeLensData(codeLens: CodeLens): CodeLensData {
  return {
    range: new atom$Range(
      new Point(codeLens.range.start.line, codeLens.range.start.character),
      new Point(codeLens.range.end.line, codeLens.range.end.character),
    ),
    command: codeLens.command,
    data: codeLens.data,
  };
}

export function lspSignatureHelp_atomSignatureHelp(
  signatureHelp: LspSignatureHelpType,
): SignatureHelp {
  // Mostly compatible, except for the MarkupContent strings.
  // Currently, atom-ide-ui's signature help implementation always renders markdown anyway.
  return {
    signatures: signatureHelp.signatures.map(sig => ({
      label: sig.label,
      documentation:
        sig.documentation != null && typeof sig.documentation === 'object'
          ? sig.documentation.value
          : sig.documentation,
      parameters:
        sig.parameters &&
        sig.parameters.map(param => ({
          label: param.label,
          documentation:
            param.documentation != null &&
            typeof param.documentation === 'object'
              ? param.documentation.value
              : param.documentation,
        })),
    })),
    activeSignature: signatureHelp.activeSignature,
    activeParameter: signatureHelp.activeParameter,
  };
}

export function watchmanFileChange_lspFileEvent(
  fileChange: FileChange,
  watchmanRoot: NuclideUri,
): FileEvent {
  return {
    uri: localPath_lspUri(nuclideUri.resolve(watchmanRoot, fileChange.name)),
    type: fileChange.new
      ? FileChangeType.Created
      : !fileChange.exists
        ? FileChangeType.Deleted
        : FileChangeType.Changed,
  };
}

export function lspStatus_atomStatus(params: ShowStatusParams): ?StatusData {
  const actions = params.actions || [];
  const buttons = actions.map(action => action.title);
  switch (params.type) {
    case LspMessageType.Error:
      return {
        kind: 'red',
        message: params.message == null ? '' : params.message,
        buttons,
      };
    case LspMessageType.Warning:
      return {
        kind: 'yellow',
        message: params.message == null ? '' : params.message,
        shortMessage: params.shortMessage,
        progress:
          params.progress == null
            ? undefined
            : {
                numerator: params.progress.numerator,
                denominator: params.progress.denominator,
              },
        buttons,
      };
    case LspMessageType.Info:
      return {kind: 'green', message: params.message};
    default:
      return null;
  }
}
