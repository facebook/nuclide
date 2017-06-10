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

// Flow definitions for Microsoft's Language Server Protocol
// https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md
// https://github.com/Microsoft/language-server-protocol/blob/master/versions/protocol-2-x.md

// Structures

export type Position = {
  // Line position in a document (zero-based).
  line: number,
  // Character offset on a line in a document (zero-based).
  character: number,
};

export type Range = {
  // The range's start position.
  start: Position,
  // The range's end position.
  end: Position,
};

export type Location = {
  // The location's URI.
  uri: string,
  // The position within the URI.
  range: Range,
};

export type Diagnostic = {
  // The range at which the message applies.
  range: Range,
  // The diagnostic's severity. Can be omitted. If omitted it is up to the
  // client to interpret diagnostics as error, warning, info or hint.
  severity?: number,
  // The diagnostic's code. Can be omitted.
  code?: number | string,
  // A human-readable string describing the source of this
  // diagnostic, e.g. 'typescript' or 'super lint'.
  source?: string,
  // The diagnostic's message.
  message: string,
};

export const DiagnosticSeverity = {
  // Reports an error.
  Error: 1,
  // Reports a warning.
  Warning: 2,
  // Reports an information.
  Information: 3,
  // Reports a hint.
  Hint: 4,
};

export type Command = {
  // Title of the command, like `save`.
  title: string,
  // The identifier of the actual command handler.
  command: string,
  // Arguments that the command handler should be invoked with.
  arguments?: any[],
};

export type TextEdit = {
  // The range of the text document to be manipulated. To insert
  // text into a document create a range where start === end.
  range: Range,
  // The string to be inserted. For delete operations use an empty string.
  newText: string,
};

export type WorkspaceEdit = {
  // Holds changes to existing resources.
  changes: {[uri: string]: TextEdit[]},
};

export type TextDocumentIdentifier = {
  // The text document's URI.
  uri: string,
};

export type TextDocumentItem = {
  // The text document's URI.
  uri: string,
  // The text document's language identifier.
  languageId: string,
  // The version number of this document (it will strictly increase after each
  // change, including undo/redo).
  version: number,
  // The content of the opened text document.
  text: string,
};

export type VersionedTextDocumentIdentifier = TextDocumentIdentifier & {
  // The version number of this document.
  version: number,
};

export type TextDocumentPositionParams = {
  // The text document.
  textDocument: TextDocumentIdentifier,
  // The position inside the text document.
  position: Position,
};

// General

export const ErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  serverErrorStart: -32099,
  serverErrorEnd: -32000,
  ServerNotInitialized: -32002,
  UnknownErrorCode: -32001,
  RequestCancelled: -32800,
};

export type InitializeParams = {
  //  The process Id of the parent process that started
  //  the server. Is null if the process has not been started by another process.
  //  If the parent process is not alive then the server should exit
  // (see exit notification) its process.
  processId?: number,
  //  The rootPath of the workspace. Is null if no folder is open.
  rootPath?: string,
  //  The rootUri of the workspace. Is null if no folder is open. If both
  //  `rootPath` and `rootUri` are set rootUri` wins.
  rootUri?: string, // TODO: this should be DocumentUri
  //  User provided initialization options.
  initializationOptions?: any,
  //  The capabilities provided by the client (editor)
  capabilities: ClientCapabilities,
  //  The initial trace setting. If omitted trace is disabled ('off')
  trace?: 'off' | 'messages' | 'verbose',
};

//  Workspace specific client capabilities.
export type WorkspaceClientCapabilities = {|
  //  The client supports applying batch edits to the workspace by supporting
  //  the request 'workspace/applyEdit'
  applyEdit?: boolean,
  //  Capabilities specific to `WorkspaceEdit`s
  workspaceEdit?: {|
    //  The client supports versioned document changes in `WorkspaceEdit`s
    documentChanges?: boolean,
  |},
  //  Capabilities specific to `workspace/didChangeConfiguration` notification.
  didChangeConfiguration?: {|
    //  Did change configuration notification supports dynamic registration.
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to `workspace/didChangeWatchedFiles` notification.
  didChangeWatchedFiles?: {|
    //  Did change watched files notification supports dynamic registration.
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `workspace/symbol` request.
  symbol?: {|
    //  Symbol request supports dynamic registration.
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `workspace/executeCommand` request.
  executeCommand?: {|
    //  Execute command supports dynamic registration.
    dynamicRegistration?: boolean,
  |},
|};

//  Text document specific client capabilities.
export type TextDocumentClientCapabilities = {|
  synchronization?: {|
    //  Whether text document synchronization supports dynamic registration.
    dynamicRegistration?: boolean,
    //  The client supports sending will save notifications.
    willSave?: boolean,
    //  The client supports sending a will save request and
    //  waits for a response providing text edits which will
    //  be applied to the document before it is saved.
    willSaveWaitUntil?: boolean,
    //  The client supports did save notifications.
    didSave?: boolean,
  |},
  //  Capabilities specific to the `textDocument/completion`
  completion?: {|
    dynamicRegistration?: boolean,
    //  The client supports the following `CompletionItem` specific capabilities
    completionItem?: {|
      //  Client supports snippets as insert text.
      //  A snippet can define tab stops and placeholders with `$1`, `$2`
      //  and `${3:foo}`. `$0` defines the final tab stop, it defaults to
      //  the end of the snippet. Placeholders with equal identifiers are linked
      //  that is typing in one will update others too.
      snippetSupport?: boolean,
    |},
  |},
  //  Capabilities specific to the `textDocument/hover`
  hover?: {|
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `textDocument/signatureHelp`
  signatureHelp?: {|
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `textDocument/references`
  references?: {|
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `textDocument/documentHighlight`
  documentHighlight?: {|
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `textDocument/documentSymbol`
  documentSymbol?: {|
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `textDocument/formatting`
  formatting?: {|
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `textDocument/rangeFormatting`
  rangeFormatting?: {|
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `textDocument/onTypeFormatting`
  onTypeFormatting?: {|
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `textDocument/definition`
  definition?: {|
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `textDocument/codeAction`
  codeAction?: {|
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `textDocument/codeLens`
  codeLens?: {|
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `textDocument/documentLink`
  documentLink?: {|
    dynamicRegistration?: boolean,
  |},
  //  Capabilities specific to the `textDocument/rename`
  rename?: {|
    dynamicRegistration?: boolean,
  |},
|};

export type ClientCapabilities = {|
  //  Workspace specific client capabilities.
  workspace?: WorkspaceClientCapabilities,
  //  Text document specific client capabilities.
  textDocument?: TextDocumentClientCapabilities,
  //  Experimental client capabilities.
  experimental?: mixed,
|};

export type InitializeResult = {
  //  The capabilities the language server provides.
  capabilities: ServerCapabilities,
};

export type InitializeError = {
  //  Indicates whether the client should retry to send the
  //  initilize request after showing the message provided
  //  in the ResponseError.
  retry: boolean,
};

// Defines how the host (editor) should sync document changes to the language server.
export const TextDocumentSyncKind = {
  //  Documents should not be synced at all.
  None: 0,
  //  Documents are synced by always sending the full content of the document.
  Full: 1,
  //  Documents are synced by sending the full content on open. After that only incremental
  //  updates to the document are sent.
  Incremental: 2,
};

// Completion options.
export type CompletionOptions = {
  // The server provides support to resolve additional information for a completion item.
  resolveProvider?: boolean,
  // The characters that trigger completion automatically.
  triggerCharacters?: string[],
};

// Signature help options.
export type SignatureHelpOptions = {
  // The characters that trigger signature help automatically.
  triggerCharacters?: string[],
};

// Code Lens options.
export type CodeLensOptions = {
  // Code lens has a resolve provider as well.
  resolveProvider?: boolean,
};

// Format document on type options
export type DocumentOnTypeFormattingOptions = {
  // A character on which formatting should be triggered, like `};`.
  firstTriggerCharacter: string,
  // More trigger characters.
  moreTriggerCharacter?: string[],
};

// Save options.
export type SaveOptions = {
  // The client is supposed to include the content on save.
  includeText?: boolean,
};

export type TextDocumentSyncOptions = {
  // Open and close notifications are sent to the server.
  openClose?: boolean,
  // Change notifications are sent to the server. One of TextDocumentSyncKind.
  change?: number,
  // Will save notifications are sent to the server.
  willSave?: boolean,
  // Will save wait until requests are sent to the server.
  willSaveWaitUntil?: boolean,
  // Save notifications are sent to the server.
  save?: SaveOptions,
};

export type ServerCapabilities = {
  // Defines how text documents are synced. If a number, is one of TextDocumentSyncKind
  textDocumentSync?: TextDocumentSyncOptions | number,
  // The server provides hover support.
  hoverProvider?: boolean,
  // The server provides completion support.
  completionProvider?: CompletionOptions,
  // The server provides signature help support.
  signatureHelpProvider?: SignatureHelpOptions,
  // The server provides goto definition support.
  definitionProvider?: boolean,
  // The server provides find references support.
  referencesProvider?: boolean,
  // The server provides document highlight support.
  documentHighlightProvider?: boolean,
  // The server provides document symbol support.
  documentSymbolProvider?: boolean,
  // The server provides workspace symbol support.
  workspaceSymbolProvider?: boolean,
  // The server provides code actions.
  codeActionProvider?: boolean,
  // The server provides code lens.
  codeLensProvider?: CodeLensOptions,
  // The server provides document formatting.
  documentFormattingProvider?: boolean,
  // The server provides document range formatting.
  documentRangeFormattingProvider?: boolean,
  // The server provides document formatting on typing.
  documentOnTypeFormattingProvider?: DocumentOnTypeFormattingOptions,
  // The server provides rename support.
  renameProvider?: boolean,
  // The server provides type coverage support.
  typeCoverageProvider?: boolean,
};

// Document

export type PublishDiagnosticsParams = {
  // The URI for which diagnostic information is reported.
  uri: string,
  // An array of diagnostic information items.
  diagnostics: Diagnostic[],
};

// Represents a collection of [completion items](#CompletionItem) to be presented in the editor.
export type CompletionList = {
  // This list it not complete. Further typing should result in recomputing this list.
  isIncomplete: boolean,
  // The completion items.
  items: CompletionItem[],
};

export type CompletionItem = {
  //  The label of this completion item. By default
  //  also the text that is inserted when selecting
  //  this completion.
  label: string,
  // The kind of this completion item. Based of the kind an icon is chosen by the editor.
  kind?: number,
  // A human-readable string with additional information
  // about this item, like type or symbol information.
  detail?: string,
  // A human-readable string that represents a doc-comment.
  documentation?: string,
  //  A string that shoud be used when comparing this item
  //  with other items. When `falsy` the label is used.
  sortText?: string,
  //  A string that should be used when filtering a set of
  //  completion items. When `falsy` the label is used.
  filterText?: string,
  //  A string that should be inserted a document when selecting
  //  this completion. When `falsy` the label is used.
  insertText?: string,
  //  An edit which is applied to a document when selecting
  //  this completion. When an edit is provided the value of
  //  insertText is ignored.
  textEdit?: TextEdit,
  //  An optional array of additional text edits that are applied when
  //  selecting this completion. Edits must not overlap with the main edit
  //  nor with themselves.
  additionalTextEdits?: TextEdit[],
  //  An optional command that is executed *after* inserting this completion. *Note* that
  //  additional modifications to the current document should be described with the
  //  additionalTextEdits-property.
  command?: Command,
  //  An data entry field that is preserved on a completion item between
  //  a completion and a completion resolve request.
  data?: any,
};

// The kind of a completion entry.
export const CompletionItemKind = {
  Text: 1,
  Method: 2,
  Function: 3,
  Constructor: 4,
  Field: 5,
  Variable: 6,
  Class: 7,
  Interface: 8,
  Module: 9,
  Property: 10,
  Unit: 11,
  Value: 12,
  Enum: 13,
  Keyword: 14,
  Snippet: 15,
  Color: 16,
  File: 17,
  Reference: 18,
};

// The result of a hover request.
export type Hover = {
  // The hover's content
  contents: MarkedString | MarkedString[],
  // An optional range is a range inside a text document
  // that is used to visualize a hover, e.g. by changing the background color.
  range?: Range,
};

/**
 * The marked string is rendered:
 * - as markdown if it is represented as a string
 * - as code block of the given langauge if it is represented as a pair of a language and a value
 *
 * The pair of a language and a value is an equivalent to markdown:
 * ```${language};
 * ${value};
 * ```
 */
export type MarkedString = string | {language: string, value: string};

/**
 * Signature help represents the signature of something
 * callable. There can be multiple signature but only one
 * active and only one active parameter.
 */
export type SignatureHelp = {
  // One or more signatures.
  signatures: SignatureInformation[],
  // The active signature.
  activeSignature?: number,
  // The active parameter of the active signature.
  activeParameter?: number,
};

/**
 * Represents the signature of something callable. A signature
 * can have a label, like a function-name, a doc-comment, and
 * a set of parameters.
 */
export type SignatureInformation = {
  // The label of this signature. Will be shown in the UI.
  label: string,
  //  The human-readable doc-comment of this signature. Will be shown in the UI but can be omitted.
  documentation?: string,
  // The parameters of this signature.
  parameters?: ParameterInformation[],
};

/**
 * Represents a parameter of a callable-signature. A parameter can
 * have a label and a doc-comment.
 */
export type ParameterInformation = {
  // The label of this parameter. Will be shown in the UI.
  label: string,
  // The human-readable doc-comment of this parameter. Will be shown in the UI but can be omitted.
  documentation?: string,
};

export type ReferenceParams = TextDocumentPositionParams & {
  context: ReferenceContext,
};

export type ReferenceContext = {
  // Include the declaration of the current symbol.
  includeDeclaration: boolean,
};

/**
 * A document highlight is a range inside a text document which deserves
 * special attention. Usually a document highlight is visualized by changing
 * the background color of its range.
 *
 */
export type DocumentHighlight = {
  // The range this highlight applies to.
  range: Range,
  // The highlight kind, default is DocumentHighlightKind.Text.
  kind?: number,
};

export const DocumentHighlightKind = {
  // A textual occurrance.
  Text: 1,
  // Read-access of a symbol, like reading a variable.
  Read: 2,
  // Write-access of a symbol, like writing to a variable.
  Write: 3,
};

export type DocumentSymbolParams = {
  // The text document.
  textDocument: TextDocumentIdentifier,
};

/**
 * Represents information about programming constructs like variables, classes,
 * interfaces etc.
 */
export type SymbolInformation = {
  // The name of this symbol.
  name: string,
  // The kind of this symbol.
  kind: number,
  // The location of this symbol.
  location: Location,
  // The name of the symbol containing this symbol.
  containerName?: string,
};

export const SymbolKind = {
  File: 1,
  Module: 2,
  Namespace: 3,
  Package: 4,
  Class: 5,
  Method: 6,
  Property: 7,
  Field: 8,
  Constructor: 9,
  Enum: 10,
  Interface: 11,
  Function: 12,
  Variable: 13,
  Constant: 14,
  String: 15,
  Number: 16,
  Boolean: 17,
  Array: 18,
};

// The parameters of a Workspace Symbol Request.
export type WorkspaceSymbolParams = {
  // A non-empty query string.
  query: string,
};

// Params for the CodeActionRequest
export type CodeActionParams = {
  // The document in which the command was invoked.
  textDocument: TextDocumentIdentifier,
  // The range for which the command was invoked.
  range: Range,
  // Context carrying additional information.
  context: CodeActionContext,
};

// Contains additional diagnostic information about the context in which a code action is run.
export type CodeActionContext = {
  // An array of diagnostics.
  diagnostics: Diagnostic[],
};

export type CodeLensParams = {
  // The document to request code lens for.
  textDocument: TextDocumentIdentifier,
};

/**
 * A code lens represents a command that should be shown along with
 * source text, like the number of references, a way to run tests, etc.
 *
 * A code lens is _unresolved_ when no command is associated to it. For performance
 * reasons the creation of a code lens and resolving should be done in two stages.
 */
export type CodeLens = {
  // The range in which this code lens is valid. Should only span a single line.
  range: Range,
  // The command this code lens represents.
  command?: Command,
  // A data entry field that is preserved on a code lens item between a code lens
  // and a code lens resolve request.
  data?: any,
};

export type DocumentLinkParams = {
  // The document to provide document links for.
  textDocument: TextDocumentIdentifier,
};

/**
 * A document link is a range in a text document that links to an internal or
* external resource, like another
 * text document or a web site.
 */
export type DocumentLink = {
  // The range this link applies to.
  range: Range,
  // The uri this link points to.
  target: string,
};

export type DocumentFormattingParams = {
  // The document to format.
  textDocument: TextDocumentIdentifier,
  // The format options.
  options: FormattingOptions,
};

// Value-object describing what options formatting should use.
export type FormattingOptions = {
  // Signature for further properties.
  [key: string]: boolean | number | string,
  // Size of a tab in spaces.
  tabSize: number,
  // Prefer spaces over tabs.
  insertSpaces: boolean,
};

export type DocumentRangeFormattingParams = {
  // The document to format.
  textDocument: TextDocumentIdentifier,
  // The range to format.
  range: Range,
  // The format options.
  options: FormattingOptions,
};

export type DocumentOnTypeFormattingParams = {
  // The document to format.
  textDocument: TextDocumentIdentifier,
  // The position at which this request was sent.
  position: Position,
  // The character that has been typed.
  ch: string,
  // The format options.
  options: FormattingOptions,
};

export type RenameParams = {
  // The document to format.
  textDocument: TextDocumentIdentifier,
  // The position at which this request was sent.
  position: Position,
  /**
   * The new name of the symbol. If the given name is not valid the
   * request must return a [ResponseError](#ResponseError) with an
   * appropriate message set.
   */
  newName: string,
};

// TypeCoverageParams: a nuclide-specific way to show type coverage for a file
export type TypeCoverageParams = {
  textDocument: TextDocumentIdentifier, // The text document.
};

export type TypeCoverageResult = {
  coveredPercent: number, // what percent of the file is covered?
  uncoveredRanges: UncoveredRange[],
};

export type UncoveredRange = {
  range: Range,
  message: string, // human-readable explanation, maybe with suggested fix
};

// Window

export type ShowMessageParams = {
  // The message type. See {@link MessageType};.
  type: number,
  // The actual message.
  message: string,
};

export const MessageType = {
  // An error message.
  Error: 1,
  // A warning message.
  Warning: 2,
  // An information message.
  Info: 3,
  // A log message.
  Log: 4,
};

export type ShowMessageRequestParams = {
  // The message type. See {@link MessageType};
  type: number,
  // The actual message
  message: string,
  // The message action items to present.
  actions?: MessageActionItem[],
};

export type MessageActionItem = {
  // A short title like 'Retry', 'Open Log' etc.
  title: string,
};

export type LogMessageParams = {
  // The message type. See {@link MessageType};
  type: number,
  // The actual message
  message: string,
};

// Workspace

export type DidChangeConfigurationParams = {
  // The actual changed settings
  settings: any,
};

export type DidOpenTextDocumentParams = {
  // The document that was opened.
  textDocument: TextDocumentItem,
};

export type DidChangeTextDocumentParams = {
  // The document that did change. The version number points
  // to the version after all provided content changes have
  // been applied.
  textDocument: VersionedTextDocumentIdentifier,
  // The actual content changes.
  contentChanges: TextDocumentContentChangeEvent[],
};

// An event describing a change to a text document. If range and rangeLength are omitted
// the new text is considered to be the full content of the document.
export type TextDocumentContentChangeEvent = {
  // The range of the document that changed.
  range?: Range,
  // The length of the range that got replaced.
  rangeLength?: number,
  // The new text of the document.
  text: string,
};

export type DidCloseTextDocumentParams = {
  // The document that was closed.
  textDocument: TextDocumentIdentifier,
};

export type DidSaveTextDocumentParams = {
  // The document that was saved.
  textDocument: TextDocumentIdentifier,
};

export type DidChangeWatchedFilesParams = {
  // The actual file events.
  changes: FileEvent[],
};

// The file event type.
export const FileChangeType = {
  // The file got created.
  Created: 1,
  // The file got changed.
  Changed: 2,
  // The file got deleted.
  Deleted: 3,
};

// An event describing a file change.
export type FileEvent = {
  // The file's URI.
  uri: string,
  // The change type.
  type: number,
};
