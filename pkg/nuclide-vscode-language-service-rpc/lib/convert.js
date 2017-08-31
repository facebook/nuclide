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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {TokenizedText} from 'nuclide-commons/tokenized-text';
import type {
  Definition,
  DiagnosticMessageType,
  DiagnosticTrace,
  FileDiagnosticMessage,
  FileDiagnosticMessages,
  Reference,
  CodeAction,
} from 'atom-ide-ui';
import type {
  Diagnostic,
  PublishDiagnosticsParams,
  RelatedLocation,
} from './protocol';
import type {
  Completion,
  SymbolResult,
} from '../../nuclide-language-service/lib/LanguageService';
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
} from './protocol';
import type {TextEdit as LspTextEditType} from './protocol';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {Point, Range as atom$Range} from 'simple-text-buffer';
import {
  CompletionItemKind,
  DiagnosticSeverity,
  InsertTextFormat,
  SymbolKind,
  MessageType as LspMessageType,
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

export function lspLocation_atomFoundReference(location: Location): Reference {
  return {
    uri: lspUri_localPath(location.uri),
    // although called a "uri" its really a string used for grouping.
    name: null,
    range: lspRange_atomRange(location.range),
  };
}

export function lspLocation_atomDefinition(
  location: Location,
  projectRoot: NuclideUri,
): Definition {
  return {
    path: lspUri_localPath(location.uri),
    position: lspPosition_atomPoint(location.range.start),
    language: 'lsp', // pointless; only ever used to judge equality of two defs
    projectRoot, // used to relativize paths when showing multiple targets
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

function lspCompletionItemKind_atomCompletionType(kind: ?number): ?string {
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

export function lspCompletionItem_atomCompletion(
  item: CompletionItem,
): Completion {
  const useSnippet = item.insertTextFormat === InsertTextFormat.Snippet;
  const lspTextEdits = getCompletionTextEdits(item);
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
    // LSP: [nuclide-specific] itemType is return type of function
    // Atom: it's convention to display return types in the left column
    leftLabel: item.itemType,
    // LSP: [nuclide-specific] inlineDetail is to be displayed next to label
    // Atom: it's convention to display details like parameters to the right
    rightLabel: item.inlineDetail,
    // LSP: kind indicates what icon should be used
    // ATOM: type is to indicate icon and its background color
    type: lspCompletionItemKind_atomCompletionType(item.kind),
    // LSP detail is the thing's signature
    // Atom: description is displayed in the footer of the autocomplete tab
    description: item.detail,
    textEdits:
      lspTextEdits != null
        ? lspTextEdits_atomTextEdits(lspTextEdits)
        : undefined,
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
      return 'file';
    case SymbolKind.Module:
      return 'file-submodule';
    case SymbolKind.Namespace:
      return 'file-submodule';
    case SymbolKind.Package:
      return 'package';
    case SymbolKind.Class:
      return 'code';
    case SymbolKind.Method:
      return 'zap';
    case SymbolKind.Property:
      return 'key';
    case SymbolKind.Field:
      return 'key';
    case SymbolKind.Constructor:
      return 'zap';
    case SymbolKind.Enum:
      return 'file-binary';
    case SymbolKind.Interface:
      return 'puzzle';
    case SymbolKind.Function:
      return 'zap';
    case SymbolKind.Variable:
      return 'pencil';
    case SymbolKind.Constant:
      return 'quote';
    case SymbolKind.String:
      return 'quote';
    case SymbolKind.Number:
      return 'quote';
    case SymbolKind.Boolean:
      return 'quote';
    case SymbolKind.Array:
      return 'list-ordered';
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
    case DiagnosticSeverity.Hint:
      return 'Info';
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
      // The inverse function maps both DiagnosticServerity.Hint and
      // DiagnosticServerity.Information to 'Info', but in the reverse direction
      // we'll pick to map 'Info' to DiagnosticSeverity.Information.
      return DiagnosticSeverity.Information;
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
): FileDiagnosticMessage {
  // TODO: pass the LSP diagnostic.code to Atom somehow
  return {
    scope: 'file',
    // flowlint-next-line sketchy-null-string:off
    providerName: diagnostic.source || 'LSP', // TODO
    type: lspSeverity_atomDiagnosticMessageType(diagnostic.severity),
    filePath,
    text: diagnostic.message,
    range: lspRange_atomRange(diagnostic.range),
    trace: (diagnostic.relatedLocations || [])
      .map(lspRelatedLocation_atomTrace),
  };
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
    return {
      range: atomRange_lspRange(diagnostic.range),
      severity: atomDiagnosticMessageType_lspSeverity(diagnostic.type),
      source: diagnostic.providerName,
      message: diagnostic.text || '',
      relatedLocations: arrayCompact(
        (diagnostic.trace || []).map(atomTrace_lspRelatedLocation),
      ),
    };
  }
  return null;
}

export function lspDiagnostics_atomDiagnostics(
  params: PublishDiagnosticsParams,
): Array<FileDiagnosticMessages> {
  const filePath = lspUri_localPath(params.uri);
  return [
    {
      filePath,
      messages: params.diagnostics.map(d =>
        lspDiagnostic_atomDiagnostic(d, filePath),
      ),
    },
  ];
}
