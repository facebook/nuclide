/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

/*eslint-disable no-unused-vars */

/**
 * Private Classes
 */

declare class atom$Model {
  destroy(): void;
}

declare class atom$Package {
  activateTime: number;
  mainModule: any;
  name: string;
  loadTime: number;
  getType(): 'atom' | 'textmate' | 'theme';
  hasActivationCommands(): boolean;
  hasActivationHooks(): boolean;
}

/**
 * Essential Classes
 */
type atom$IDisposable = {
  dispose: () => void;
}

type atom$CommandCallback = (event: Event) => mixed;

declare class atom$CommandRegistry {
  // Methods
  add(
    target: string | HTMLElement,
    commandNameOrCommands: string | {[commandName: string]: atom$CommandCallback},
    callback?: atom$CommandCallback
  ): atom$Disposable;
  dispatch(target: HTMLElement, commandName: string): void;
}

declare class atom$CompositeDisposable {
  constructor(...disposables: atom$IDisposable[]): void;
  dispose(): void;

  add(disposable: atom$IDisposable): void;
  remove(disposable: atom$IDisposable): void;
  clear(): void;
}

type atom$ConfigType =
  'boolean' | 'string' | 'integer' | 'number' |
  'array' | 'object' | 'color' | 'any'

type atom$ConfigSchema = {
  default?: mixed,
  description?: string,
  enum?: Array<mixed>,
  maximum?: number,
  minimum?: number,
  properties?: Object,
  title?: string,
  type: Array<atom$ConfigType> | atom$ConfigType,
}

declare class atom$Config {
  // Config Subscription
  observe(
    keyPath: string,
    optionsOrCallback?: (Object | (value: any) => void),
    callback?: (value: any) => void
  ): atom$IDisposable;

  onDidChange(
    keyPathOrCallback: (string | (event: Object) => void),
    optionsOrCallback?: (Object | (event: Object) => void),
    callback?: (event: Object) => void
  ): atom$IDisposable;

  // Managing Settings
  get(
    keyPath?: string,
    options?: {
      excludeSources?: Array<string>;
      sources?: Array<string>;
      scope?: Object;
    }
  ): mixed;

  set(
    keyPath: string,
    value: ?mixed,
    options?: {
      scopeSelector?: string,
      source?: string,
    },
  ): boolean;

  unset(
    keyPath: string,
    options?: {
      scopeSelector?: string,
      source?: string,
    }
  ): void;

  getUserConfigPath(): string;

  // Undocumented Methods
  getRawValue(keyPath: ?string, options: {excludeSources?: string, sources?: string}): mixed;
  getSchema(keyPath: string): atom$ConfigSchema;
  save(): void;
  setRawValue(keyPath: string, value: mixed): void;
  setSchema(
    keyPath: string,
    schema: atom$ConfigSchema,
  ): void;
}

declare class atom$Cursor {
  // Event Subscription
  // Managing Cursor Position
  getBufferRow(): number;
  getBufferColumn(): number;
  getBufferPosition(): atom$Point;

  // Cursor Position Details
  // Moving the Cursor

  // Local Positions and Ranges
  getCurrentWordBufferRange(options?: {wordRegex: RegExp}): atom$Range;
  getCurrentWordPrefix(): string;

  // Visibility
  // Comparing to another cursor
  // Utilities
  wordRegExp(options?: {includeNonWordCharacters: boolean}): RegExp;
}

declare class atom$Decoration {
  destroy(): void;
  onDidChangeProperties(
    callback: (event: {oldProperties: Object; newProperties: Object}) => mixed
    ): atom$Disposable;
  getMarker(): atom$Marker;
  getProperties(): Object;
  setProperties(properties: mixed): void;
}

declare class atom$Disposable {
  constructor(disposalAction: (...args: any[]) => any): void;
  dispose(): void;
}

declare class atom$Emitter {
  dispose(): void;
  on(name: string, callback: (v: any) => mixed): atom$Disposable;
  preempt(name: string, callback: (v: any) => void): atom$Disposable;
  emit(name: string, value: any): atom$Disposable;
}

declare class atom$Gutter {
  name: string;
  destroy(): void;
  decorateMarker(
    marker: atom$Marker,
    options?: {'class'?: string; item?: Object | HTMLElement}): void;
  show(): void;
  hide(): void;
  onDidDestroy(callback: () => void): atom$Disposable;
}

declare class atom$Marker {
  destroy(): void;
  getBufferRange(): atom$Range;
  getStartBufferPosition(): atom$Point;
  onDidChange(callback: (event: {
    oldHeadScreenPosition: atom$Point;
    newHeadScreenPosition: atom$Point;
    oldTailScreenPosition: atom$Point;
    newTailScreenPosition: atom$Point;

    oldHeadBufferPosition: atom$Point;
    newHeadBufferPosition: atom$Point;
    oldTailBufferPosition: atom$Point;
    newTailBufferPosition: atom$Point;

    isValid: boolean;
    textChanged: boolean;
  }) => void): atom$Disposable;
  onDidDestroy(callback: () => void): atom$Disposable;
}

declare class atom$ServiceHub {
  provide<T>(keyPath: string, version: string, service: T): atom$Disposable;
  consume<T>(
    keyPath: string,
    versionRange: string,
    callback: (provider: T) => mixed
  ): atom$Disposable;
}

declare class atom$PackageManager {
  // Event Subscription
  onDidLoadInitialPackages(callback: () => void): atom$Disposable;
  onDidActivateInitialPackages(callback: () => void): atom$Disposable;
  onDidActivatePackage(callback: (pkg: atom$Package) => mixed): atom$Disposable;
  onDidDeactivatePackage(callback: (pkg: atom$Package) => mixed): atom$Disposable;
  onDidLoadPackage(callback: (pkg: atom$Package) => mixed): atom$Disposable;

  // Package system data
  getApmPath(): string;
  getPackageDirPaths(): Array<string>;

  // General package data
  resolvePackagePath(name: string): ?string;
  isBundledPackage(name: string): boolean;

  // Enabling and disabling packages
  enablePackage(name: string): ?atom$Package;
  disablePackage(name: string): ?atom$Package;
  isPackageDisabled(name: string): boolean;

  // Accessing active packages
  getActivePackage(name: string): ?atom$Package;
  getActivePackages(): Array<atom$Package>;
  isPackageActive(name: string): boolean;

  // Activating and deactivating packages
  activatePackage(name: string): Promise<atom$Package>;

  // Accessing loaded packages
  getLoadedPackages(): Array<atom$Package>;
  isPackageLoaded(name: string): boolean;

  // Accessing available packages
  getAvailablePackageNames(): Array<string>;

  // (Undocumented.)
  activate(): Promise;
  deactivatePackages(): void;
  deactivatePackage(name: string): void;
  loadPackage(name: string): void;
  loadPackages(): void;
  serviceHub: atom$ServiceHub;
  packageDirPaths: Array<string>;
  unloadPackage(name: string): void;
  unloadPackages(): void;
}

type atom$PaneSplitParams = {
  copyActiveItem?: boolean;
  items?: Array<Object>;
};

type atom$PaneSplitOrientation = 'horizontal' | 'vertical';
type atom$PaneSplitSide = 'before' | 'after';

declare class atom$Pane {
  // Items
  addItem(item: Object, index?: number): Object;
  getItems(): Array<Object>;
  getActiveItem(): ?Object;
  itemAtIndex(index: number): ?Object;
  getActiveItemIndex(): number;
  activateItem(item: Object): ?Object;
  moveItemToPane(item: Object, pane: atom$Pane, index: number): void;
  destroyItem(item: Object): boolean;
  itemForURI(uri: string): Object;

  // Lifecycle
  isActive(): boolean;
  activate(): void;
  destroy(): void;

  // Splitting
  splitLeft(params?: atom$PaneSplitParams): atom$Pane;
  splitRight(params?: atom$PaneSplitParams): atom$Pane;
  splitUp(params?: atom$PaneSplitParams): atom$Pane;
  splitDown(params?: atom$PaneSplitParams): atom$Pane;
  split(
    orientation: atom$PaneSplitOrientation,
    side: atom$PaneSplitSide,
    params?: atom$PaneSplitParams,
  ): atom$Pane;

  // Undocumented Methods
  getFlexScale(): number;
  getParent(): Object;
  removeItem(item: Object, moved: ?boolean): void;
  setActiveItem(item: Object): Object;
  setFlexScale(flexScale: number): number;
}

// Undocumented class
declare class atom$PaneAxis {
  getFlexScale(): number;
  setFlexScale(flexScale: number): number;
  getItems(): Array<Object>;
}

declare class atom$Panel {
  // Construction and Destruction
  destroy(): void;

  // Event Subscription
  onDidChangeVisible(callback: (visible: boolean) => any): atom$Disposable;
  onDidDestroy(callback: (panel: atom$Panel) => any): atom$Disposable;

  // Panel Details
  getItem(): HTMLElement;
  getPriority(): number;
  isVisible(): boolean;
  hide(): void;
  show(): void;
}

declare class atom$Point {
  static fromObject(object: atom$Point | [number, number], copy:? boolean): atom$Point;
  constructor(row: number, column: number): void;
  row: number;
  column: number;
  copy(): atom$Point;
  negate(): atom$Point;

  // Comparison
  min(point1: atom$Point, point2: atom$Point): atom$Point;
  // TODO(t8220399): Change this to: `-1 | 0 | 1`.
  compare(other: atom$Point): number;
  isEqual(otherRange: atom$Point): boolean;

  // Operations
  translate(other: atom$Point | [number, number]): atom$Point;

  // Conversion
  serialize(): Array<number>;
  toArray(): Array<number>;
}

type RangeConstructorArg =
  atom$Point |
  number |
  [number, number];

declare class atom$Range {
  static fromObject(
    object: atom$Range | [atom$Point | [number, number], atom$Point | [number, number]],
    copy?: boolean,
  ): atom$Range;
  constructor(pointA: RangeConstructorArg, pointB: RangeConstructorArg): void;
  start: atom$Point;
  end: atom$Point;
  isEqual(otherRange: atom$Range): boolean;
  containsPoint(point: atom$Point, exclusive?: boolean): boolean;
  serialize(): Array<Array<number>>;
}

type RawStatusBarTile = {
  item: HTMLElement;
  priority: number;
}

type atom$StatusBarTile = {
  getPriority(): number;
  getItem(): HTMLElement;
  destroy(): void;
}

declare class atom$ScopeDescriptor {
  constructor(object: {scopes: Array<string>}): void;
  getScopesArray(): Array<string>;
}

/**
 * This API is defined at https://github.com/atom/status-bar.
 */
declare class atom$StatusBar {
  addLeftTile(tile: RawStatusBarTile): atom$StatusBarTile;
  addRightTile(tile: RawStatusBarTile): atom$StatusBarTile;
  getLeftTiles(): Array<atom$StatusBarTile>;
  getRightTiles(): Array<atom$StatusBarTile>;
}

declare class atom$ThemeManager {
  // Event Subscription
  /**
   * As recent as Atom 1.0.10, the implementation of this method was:
   *
   * ```
   * onDidChangeActiveThemes: (callback) ->
   *   @emitter.on 'did-change-active-themes', callback
   *   @emitter.on 'did-reload-all', callback # TODO: Remove once deprecated pre-1.0 APIs are gone
   * ```
   *
   * Due to the nature of CoffeeScript, onDidChangeActiveThemes returns a Disposable even though it
   * is not documented as doing so. However, the Disposable that it does return removes the
   * subscription on the 'did-reload-all' event (which is supposed to be deprecated) rather than the
   * 'did-change-active-themes' one.
   */
  onDidChangeActiveThemes(callback: () => mixed): atom$Disposable;

  // Accessing Loaded Themes
  getLoadedThemeNames(): Array<string>;
  getLoadedThemes(): Array<mixed>; // TODO: Define undocumented ThemePackage class.

  // Accessing Active Themes
  getActiveThemeNames(): Array<string>;
  getActiveThemes(): Array<mixed>; // TODO: Define undocumented ThemePackage class.

  // Managing Enabled Themes
  getEnabledThemeNames(): Array<string>;

  // Private
  requireStylesheet(stylesheetPath: string): atom$Disposable;
}

declare class atom$TooltipManager {
  add(
    target: HTMLElement,
    options: {
      title: string,
      keyBindingCommand?: string,
      keyBindingTarget?: HTMLElement,
    }
  ): atom$Disposable;
}

type InsertTextOptions = {
  select: boolean;
  autoIndent: boolean;
  autoIndentNewline: boolean;
  autoDecreaseIndent: boolean;
  normalizeLineEndings: ?boolean;
  undo: string;
}

type DecorateMarkerParams = {
  type: 'line',
  class: string;
  onlyHead?: boolean;
  onlyEmpty?: boolean;
  onlyNonEmpty?: boolean;
} | {
  type: 'gutter',
  class: string;
  onlyHead?: boolean;
  onlyEmpty?: boolean;
  onlyNonEmpty?: boolean;
  gutterName?: string;
} | {
  type: 'highlight',
  class?: string;
  gutterName?: string;
} | {
  type: 'overlay',
  item: Object,
  position?: 'head' | 'tail', // Defaults to 'head' when unspecified.
};

declare class atom$TextEditor extends atom$Model {
  id: number;

  // Event Subscription
  onDidChange(callback: () => void): atom$Disposable;
  onDidStopChanging(callback: () => void): atom$Disposable;
  onDidChangeCursorPosition(callback: (event: {
    oldBufferPosition: atom$Point;
    oldScreenPosition: atom$Point;
    newBufferPosition: atom$Point;
    newScreenPosition: atom$Point;
    textChanged: boolean;
    cursor: atom$Cursor;
  }) => mixed): atom$Disposable;
  onDidDestroy(callback: () => mixed): atom$Disposable;
  onDidSave(callback: (event: {path: string}) => mixed): atom$Disposable;
  getBuffer(): atom$TextBuffer;
  observeGrammar(callback: (grammar: atom$Grammar) => mixed): atom$Disposable;
  onWillInsertText(callback: (event: {cancel: () => void; text: string;}) => void): atom$Disposable;
  // Note that the range property of the event is undocumented.
  onDidInsertText(callback: (event: {text: string; range: atom$Range}) => mixed): atom$Disposable;

  // File Details
  getTitle(): string;
  getLongTitle(): string;
  /**
   * If you open Atom via Spotlight such that it opens with a tab named
   * "untitled" that does not correspond to a file on disk, this will return
   * null.
   */
  getPath(): ?string;
  isModified(): boolean;
  isEmpty(): boolean;
  getEncoding(): string;
  setEncoding(encoding: string): void;

  // File Operations
  save(): void;
  saveAs(filePath: string): void;

  // Reading Text
  getText(): string;
  getTextInBufferRange(range: atom$Range | Array<number>): string;
  getLineCount(): number;

  // Mutating Text
  setText(text: string, options?: InsertTextOptions): void;
  setTextInBufferRange(
    range: atom$Range,
    text: string,
    options?: {
      normalizeLineEndings?: boolean;
      undo?: string;
    },
  ): atom$Range;
  insertText(text: string): atom$Range | boolean;
  delete: () => void;
  backspace: () => void;

  // History
  // TextEditor Coordinates
  screenPositionForBufferPosition(
    bufferPosition: Array<number> | atom$Point,
    options?: {
      wrapBeyondNewlines?: boolean;
      wrapAtSoftNewlines?: boolean;
      screenLine?: boolean;
    },
  ): atom$Point;
  bufferPositionForScreenPosition(
    bufferPosition: Array<number> | atom$Point,
    options?: {
      wrapBeyondNewlines?: boolean;
      wrapAtSoftNewlines?: boolean;
      screenLine?: boolean;
    },
  ): atom$Point;

  // Decorations
  decorateMarker(marker: atom$Marker, decorationParams: DecorateMarkerParams): atom$Decoration;
  decorationsForScreenRowRange(
    startScreenRow: number,
    endScreenRow: number,
  ): {[markerId: string]: Array<Object>};

  // Markers
  markBufferPosition(position: atom$Point | Array<number>): atom$Marker;
  markBufferRange(range: atom$Range | Array<Array<number>>, properties?: {
    maintainHistory?: boolean;
    reversed?: boolean;
    persistent?: boolean;
    invalidate?: string;
  }): atom$Marker;

  // Cursors
  getCursors(): Array<atom$Cursor>;
  setCursorBufferPosition(
    position: atom$Point | Array<number>,
    options?: {
      autoscroll?: boolean;
      wrapBeyondNewlines?: boolean;
      wrapAtSoftNewlines?: boolean;
      screenLine?: boolean;
    }): void;
  getCursorBufferPosition(): atom$Point;
  getCursorScreenPosition(): atom$Point;
  getCursorScreenPositions(): Array<atom$Point>;
  getLastCursor(): atom$Cursor;
  moveToEndOfLine(): void;
  moveToBottom(): void;

  // Selections
  selectAll(): void;
  getSelectedBufferRange(): atom$Range;
  getSelections(): Array<atom$Selection>;

  // Searching and Replacing
  scanInBufferRange(
    regex: RegExp,
    range: atom$Range,
    iterator: (foundMatch: {
      match: mixed;
      matchText: string;
      range: atom$Range;
      stop: () => mixed;
      replace: (replaceWith: string) => mixed;
    }) => mixed
  ): mixed;

  // Tab Behavior
  // Soft Wrap Behavior
  // Indentation
  indentationForBufferRow(bufferRow: number): number;

  lineTextForBufferRow(bufferRow: number): string;

  // Grammars
  getGrammar(): atom$Grammar;
  setGrammar(grammar: atom$Grammar): void;

  // Clipboard Operations
  pasteText: (options?: Object) => void;

  // Managing Syntax Scopes
  scopeDescriptorForBufferPosition(
    bufferPosition: atom$Point | [number, number],
  ): atom$ScopeDescriptor;

  // Gutter
  addGutter(options: {
    name: string;
    priority?: number;
    visible?: boolean;
  }): atom$Gutter;

  gutterWithName(name: string): ?atom$Gutter;

  // Scrolling the TextEditor
  scrollToBufferPosition(position: atom$Point | number[], options?: {center?: boolean}): void;
  scrollToScreenPosition(position: atom$Point | number[], options?: {center?: boolean}): void;
  scrollToBottom(): void;

  // TextEditor Rendering
  getPlaceholderText(): string;
  setPlaceholderText(placeholderText: string): void;

  // This is undocumented, but Nuclide uses it in the AtomTextEditor wrapper.
  setLineNumberGutterVisible(lineNumberGutterVisible: boolean): void;

  // Editor Options
  setSoftWrapped(softWrapped: boolean): void;

  // Undocumented Methods
  getDefaultCharWidth(): number;
  getLineHeightInPixels(): number;
  moveToTop(): void;
  tokenForBufferPosition(position: atom$Point | number[]): atom$Token;
  onDidConflict(callback: () => void): atom$Disposable;
}

/**
 * This is not part of the official Atom 1.0 API. Nevertheless, we need to reach into this object
 * via `atom$TextEditorElement` to do some things that we have no other way to do.
 */
declare class atom$TextEditorComponent {
  domNode: HTMLElement;
  linesComponent: atom$LinesComponent;
  screenPositionForMouseEvent(event: MouseEvent): atom$Point;
}

/**
 * This is not part of the official Atom 1.0 API. Nevertheless, we need it to access
 * the deepest dom element receiving DOM events.
 */
declare class atom$LinesComponent {
  domNode: HTMLElement;
  getDomNode(): HTMLElement;
}

/**
 * This is not part of the official Atom 1.0 API, but it really should be. This is the element that
 * is returned when you run `atom.views.getView(<TextEditor>)`.
 */
declare class atom$TextEditorElement extends HTMLElement {
  component: ?atom$TextEditorComponent;
  getModel(): atom$TextEditor;
  pixelPositionForBufferPosition(
    bufferPosition: {row: number, column: number} | Array<number> | atom$Point,
  ): {top: number, left: number};
  pixelPositionForScreenPosition(screenPosition: atom$Point): {
    left: number;
    top: number;
  };

  // Called when the editor is attached to the DOM.
  onDidAttach(callback: () => mixed): atom$Disposable;
  // Called when the editor is detached from the DOM.
  onDidDetach(callback: () => mixed): atom$Disposable;
}

declare class atom$ViewProvider {
  modelConstructor: Function;
}

declare class atom$ViewRegistry {
  // Methods
  addViewProvider(
    modelConstructor: any,
    createView?: (...args: any[]) => ?HTMLElement
  ): atom$Disposable;
  getView(textEditor: atom$TextEditor): atom$TextEditorElement;
  getView(notification: atom$Notification): HTMLElement;
  getView(gutter: atom$Gutter): HTMLElement;
  getView(object: Object): HTMLElement;
  providers: Array<atom$ViewProvider>;
}

type atom$WorkspaceAddPanelOptions = {
  item: Object;
  visible?: boolean;
  priority?: number;
};

type atom$TextEditorParams = {
  buffer?: atom$TextBuffer,
  lineNumberGutterVisible?: boolean,
};

declare class atom$Workspace {
  // Event Subscription
  observeTextEditors(callback: (editor: atom$TextEditor) => mixed): atom$Disposable;
  onDidChangeActivePaneItem(callback: (item: mixed) => mixed): atom$Disposable;
  onDidDestroyPaneItem(callback: (event: mixed) => mixed): atom$Disposable;
  observeActivePaneItem(callback: (item: ?mixed) => mixed): atom$Disposable;
  observePaneItems(callback: (item: mixed) => mixed): atom$Disposable;
  onWillDestroyPaneItem(
    callback: (event: {item: mixed, pane: mixed, index: number}) => mixed
  ): atom$Disposable;
  onDidOpen(callback: (event: {
    uri: string,
    item: mixed,
    pane: atom$Pane,
    index: number,
  }) => mixed): atom$Disposable;

  // Opening
  open(
    uri?: string,
    options?: {
      initialLine?: number;
      initialColumn?: number;
      split?: string;
      activePane?: boolean;
      searchAllPanes?: boolean;
    }
  ): Promise<atom$TextEditor>;
  openURIInPane(
    uri?: string,
    pane: atom$Pane,
    options?: {
      initialLine?: number;
      initialColumn?: number;
      activePane?: boolean;
      searchAllPanes?: boolean;
    }
  ): Promise<atom$TextEditor>;
  /* Optional method because this was added post-1.0. */
  buildTextEditor?: ((params: atom$TextEditorParams) => atom$TextEditor);
  reopenItem(): Promise<?atom$TextEditor>;
  addOpener(callback: (uri: string) => any): atom$Disposable;

  // Pane Items
  getPaneItems(): Array<Object>;
  getActivePaneItem(): ?Object;
  getTextEditors(): Array<atom$TextEditor>;
  getActiveTextEditor(): ?atom$TextEditor;

  // Panes
  getPanes(): Array<atom$Pane>;
  getActivePane(): atom$Pane;
  activateNextPane(): boolean;
  activatePreviousPane(): boolean;
  paneForURI(uri: string): atom$Pane;
  paneForItem(item: mixed): atom$Pane;

  // Panels
  getBottomPanels(): Array<atom$Panel>;
  addBottomPanel(options: atom$WorkspaceAddPanelOptions): atom$Panel;
  getLeftPanels(): Array<atom$Panel>;
  addLeftPanel(options: atom$WorkspaceAddPanelOptions): atom$Panel;
  getRightPanels(): Array<atom$Panel>;
  addRightPanel(options: atom$WorkspaceAddPanelOptions): atom$Panel;
  getTopPanels(): Array<atom$Panel>;
  addTopPanel(options: atom$WorkspaceAddPanelOptions): atom$Panel;
  getModalPanels(): Array<atom$Panel>;
  addModalPanel(options: atom$WorkspaceAddPanelOptions): atom$Panel;

  // Searching and Replacing

  destroyActivePaneItemOrEmptyPane(): void;
  destroyActivePaneItem(): void;

  // Undocumented properties
  paneContainer: Object;
}

/**
 * Extended Classes
 */

declare class atom$BufferedNodeProcess { }

declare class atom$BufferedProcess {
  // Event Subscription
  onWillThrowError(
    callback: (errorObject: {error: Object, handle: mixed}) => mixed
  ): atom$Disposable;
  // Helper Methods
  kill(): void;
}

declare class atom$Clipboard {
  // Methods
  write(text: string, metadata?: mixed): void;
  read(): string;
  readWithMetadata(): {
    metadata: ?mixed;
    text: string;
  };
}

declare class atom$ContextMenuManager {
  add(itemsBySelector: Object): atom$Disposable;
}

declare class atom$Deserializer {
  name: string;
  deserialize: (state: Object) => mixed;
}

declare class atom$DeserializerManager {
  add(...deserializers: atom$Deserializer[]): atom$Disposable;
  deserialize(state: Object, params: Object): mixed;
}

declare class atom$Directory {
  symlink: boolean;

  // Construction
  create(mode?: number): Promise<boolean>;

  // Event Subscription
  onDidChange(callback: () => mixed): atom$Disposable;

  // Directory Metadata
  isFile(): boolean;
  isDirectory(): boolean;
  exists():Promise<boolean>;

  // Managing Paths
  getPath(): string;
  getBaseName(): string;
  relativize(fullPath: string): string;

  // Event Subscription
  onDidRename(callback: () => void): atom$Disposable;
  onDidDelete(callback: () => void): atom$Disposable;

  // Traversing
  getParent(): atom$Directory;
  getFile(filename: string): atom$File;
  getSubdirectory(dirname: string): atom$Directory;
  getEntries(callback: (error: ?Error, entries: ?Array<atom$Directory | atom$File>) => mixed): void;
  contains(path: string): boolean;
}

declare class atom$File {
  symlink: boolean;

  // Construction
  create(): Promise<boolean>;

  // Event Subscription
  onDidChange(callback: () => mixed): atom$Disposable;

  // File Metadata
  isFile(): boolean;
  isDirectory(): boolean;
  exists(): boolean;
  setEncoding(encoding: string): void;
  getEncoding(): string;

  // Event Subscription
  onDidRename(callback: () => void): atom$Disposable;
  onDidDelete(callback: () => void): atom$Disposable;
  onDidChange(callback: () => void): atom$Disposable;

  // Managing Paths
  getPath(): string;
  getBaseName(): string;

  // Traversing
  getParent(): atom$Directory;

  // Reading and Writing
  read(flushCache?: boolean): Promise<string>;
  write(text: string): Promise<void>;
  writeSync(text: string): void;
}

declare class atom$GitRepository extends atom$Repository {
  refreshStatus(): void;
}

declare class atom$Grammar {
  name: string;
  scopeName: string;
  tokenizeLines(text: string): Array<Array<atom$GrammarToken>>;
}

type atom$GrammarToken = {
  value: string;
  scopes: Array<string>;
};

declare class atom$GrammarRegistry {
  // Event Subscription
  onDidAddGrammar(callback: (grammar: atom$Grammar) => void): atom$Disposable;

  // Managing Grammars
  grammarForScopeName(scopeName: string): ?atom$Grammar;
  removeGrammarForScopeName(scopeName: string): ?atom$Grammar;
  loadGrammarSync(grammarPath: string): atom$Grammar;
  selectGrammar(filePath: string, fileContents: string): atom$Grammar;
}

type atom$KeyBinding = Object;

declare class atom$KeymapManager {

  // Event Subscription
  onDidMatchBinding(callback: (event: {
    keystrokes: string;
    binding: atom$KeyBinding;
    keyboardEventTarget: HTMLElement;
  }) => mixed): atom$Disposable;

  onDidPartiallyMatchBinding(callback: (event: {
    keystrokes: string;
    partiallyMatchedBindings: atom$KeyBinding;
    keyboardEventTarget: HTMLElement;
  }) => mixed): atom$Disposable;

  onDidFailToMatchBinding(callback: (event: {
    keystrokes: string;
    partiallyMatchedBindings: atom$KeyBinding;
    keyboardEventTarget: HTMLElement;
  }) => mixed): atom$Disposable;

  onDidFailToReadFile(callback: (error: {
    message: string;
    stack: string;
  }) => mixed): atom$Disposable;

  // Adding and Removing Bindings
  add(source: string, bindings: Object): void;

  // Accessing Bindings
  getKeyBindings(): Array<atom$KeyBinding>;
  findKeyBindings(params: {
    keystrokes?: string;
    command: string;
    target?: HTMLElement;
  }): Array<atom$KeyBinding>;

  // Managing Keymap Files
  loadKeymap(path: string, options?: {watch: boolean}): void;
  watchKeymap(path: string): void;

  // Managing Keyboard Events
  handleKeyboardEvent(event: Event): void;
  keystrokeForKeyboardEvent(event: Event): string;
  getPartialMatchTimeout(): number;

  static buildKeydownEvent(
    key: string,
    options: {
      target: HTMLElement;
      alt?: boolean;
      cmd?: boolean;
      ctrl?: boolean;
      shift?: boolean;
    },
  ): Event;
}

declare class atom$MenuManager {
  add(items: Array<Object>): atom$Disposable;
  update(): void;
}

declare class atom$Project {
  // Event Subscription
  onDidChangePaths(callback: (projectPaths: Array<string>) => mixed): atom$Disposable;

  // Accessing the git repository
  getRepositories(): Array<?atom$Repository>;
  repositoryForDirectory(directory: atom$Directory): Promise<?atom$Repository>;

  // Managing Paths
  getPaths(): Array<string>;
  addPath(projectPath: string): void;
  setPaths(paths: Array<string>): void;
  removePath(projectPath: string): void;
  getDirectories(): Array<atom$Directory>;
  relativizePath(): Array<string>; // [projectPath: ?string, relativePath: string]
}

type TextBufferScanIterator = (arg: {
  match: Array<string>;
  matchText: string;
  range: atom$Range;
  stop(): void;
  replace(replacement: string): void;
}) => void;

declare class atom$TextBuffer {
  file: ?atom$File;
  emitter: atom$Emitter;

  // Events
  onDidChange(callback: () => mixed): atom$Disposable;
  onDidDestroy(callback: () => mixed): atom$Disposable;
  onDidStopChanging(callback: () => mixed): atom$Disposable;
  onDidSave(callback: () => mixed): atom$Disposable;
  onDidReload(callback: () => mixed): atom$Disposable;

  // File Details
  setPath(filePath: string): void;
  getPath(): string;
  setEncoding(encoding: string): void;
  getEncoding(): string;
  getUri(): string;

  // Reading Text
  isEmpty(): boolean;
  getText(): string;
  getTextInRange(range: atom$Range): string;
  getLines(): Array<string>;
  getLastLine(): string;
  lineForRow(row: number): string;
  lineEndingForRow(row: number): string;
  lineLengthForRow(row: number): number;
  isRowBlank(row: number): boolean;
  previousNonBlankRow(startRow: number): ?number;
  nextNonBlankRow(startRow: number): ?number;

  // Mutating Text
  setText(text: string): atom$Range;
  setTextInRange(range: atom$Range, text: string, options?: Object): atom$Range;
  setTextViaDiff(text: string): void;
  insert(
    position: atom$Point,
    text: string,
    options?: {
      normalizeLineEndings?: boolean;
      undo?: string;
    },
  ): atom$Range;
  append(text: string, options: ?{
    normalizeLineEndings?: boolean;
    undo?: string;
  }): atom$Range;
  delete(range: atom$Range): atom$Range;
  deleteRows(startRow: number, endRow: number): atom$Range;

  // Search And Replace
  scanInRange(regex: RegExp, range: atom$Range, iterator: TextBufferScanIterator): void;
  backwardsScanInRange(regex: RegExp, range: atom$Range, iterator: TextBufferScanIterator): void;

  // Buffer Range Details
  getLastRow(): number;
  getRange(): atom$Range;
  rangeForRow(row: number, includeNewLine?: boolean): atom$Range;

  // Position/Index mapping
  characterIndexForPosition(position: atom$Point): number;

  // Buffer Operations
  reload(): void;

  isInConflict(): boolean;
}

declare class atom$Notification {
  // Event Subscription
  onDidDismiss(callback: () => mixed): atom$Disposable;
  onDidDisplay(callback: () => mixed): atom$Disposable;

  // Methods
  getType(): string;
  getMessage(): string;
  dismiss(): void;
}

declare class atom$NotificationManager {
  // Events
  onDidAddNotification(callback: (notification: atom$Notification) => void): atom$IDisposable;

  // Adding Notifications
  addSuccess(message: string, options?: Object): atom$Notification;
  addInfo(message: string, options?: Object): atom$Notification;
  addWarning(message: string, options?: Object): atom$Notification;
  addError(message: string, options?: Object): atom$Notification;
  addFatalError(message: string, options?: Object): atom$Notification;

  // Getting Notifications
  getNotifications(): Array<atom$Notification>;
}

// The items in this declaration are available off of `require('atom')`.
// This list is not complete.
declare module 'atom' {
  declare var BufferedNodeProcess: typeof atom$BufferedNodeProcess;
  declare var BufferedProcess: typeof atom$BufferedProcess;
  declare var CompositeDisposable: typeof atom$CompositeDisposable;
  declare var Directory: typeof atom$Directory;
  declare var Disposable: typeof atom$Disposable;
  declare var Emitter: typeof atom$Emitter;
  declare var File: typeof atom$File;
  declare var GitRepository: typeof atom$GitRepository;
  declare var Notification: typeof atom$Notification;
  declare var Point: typeof atom$Point;
  declare var Range: typeof atom$Range;
  declare var TextBuffer: typeof atom$TextBuffer;
  declare var TextEditor: typeof atom$TextEditor;
}

// Make sure that common types can be referenced without the `atom$` prefix
// in type declarations.
declare var Cursor: typeof atom$Cursor;
declare var Panel: typeof atom$Panel;
declare var TextEditor: typeof atom$TextEditor;

type atom$UnhandledErrorEvent = {
  originalError: Object;
  message: string;
  url: string;
  line: number;
  column: number;
}

// The properties of this type match the properties of the `atom` global.
// This list is not complete.
type AtomGlobal = {
  // Properties
  appVersion: string;
  clipboard: atom$Clipboard;
  commands: atom$CommandRegistry;
  config: atom$Config;
  contextMenu: atom$ContextMenuManager;
  deserializers: atom$DeserializerManager;
  grammars: atom$GrammarRegistry;
  keymaps: atom$KeymapManager;
  menu: atom$MenuManager;
  notifications: atom$NotificationManager;
  packages: atom$PackageManager;
  themes: atom$ThemeManager;
  tooltips: atom$TooltipManager;
  views: atom$ViewRegistry;
  workspace: atom$Workspace;
  project: atom$Project;
  devMode: boolean;

  // Event Subscription
  onWillThrowError(callback: (event: atom$UnhandledErrorEvent) => mixed): atom$Disposable;
  onDidThrowError(callback: (event: atom$UnhandledErrorEvent) => mixed): atom$Disposable;

  // Atom Details
  inDevMode(): boolean;
  inSafeMode(): boolean;
  inSpecMode(): boolean;
  getVersion(): string;
  isReleasedVersion(): boolean;
  getWindowLoadTime(): number;

  // This is an undocumented way to reach the Electron BrowserWindow.
  getCurrentWindow(): any;

  // Messaging the User
  confirm(options: {
    buttons?: Array<string> | {[buttonName: string]: () => void};
    detailedMessage?: string;
    message: string;
  }): ?number;

  reload(): void;

  // Undocumented Methods
  getConfigDirPath(): string;
  showSaveDialogSync(options: Object): string;
}

declare var atom: AtomGlobal;

/**
 * ipc is used by webviews to communicate with the parent view.
 */
declare module 'ipc' {
  declare function on(channel: string, callback: (event: any) => void): atom$Disposable;
  declare function send(channel: string, ...args: any[]): void;
  declare function sendToHost(channel: string, ...args: any[]): void;
}

declare class WebviewElement extends HTMLElement {
  src: string;
  nodeintegration: boolean;
  disablewebsecurity: boolean;

  executeJavaScript(code: string, userGesture: ?boolean): void;
  getTitle(): string;
  send(): void;
}

type RepositoryDidChangeStatusCallback = (event: {path: string; pathStatus: number}) => mixed;
type RepositoryLineDiff = {
  oldStart: number;
  newStart: number;
  oldLines: number;
  newLines: number;
};

// Taken from the interface of GitRepository, which is also implemented
// by HgRepositoryClient.
declare class atom$Repository {
  // Event Subscription
  onDidChangeStatus: (callback: RepositoryDidChangeStatusCallback) => atom$Disposable;
  onDidChangeStatuses: (callback: () => mixed) => atom$Disposable;

  // Repository Details
  getType: () => string;
  getPath: () => string;
  getWorkingDirectory: () => string;
  isProjectAtRoot: () => boolean;
  relativize: (aPath: string) => string;

  // Reading Status
  isPathModified: (aPath: string) => boolean;
  isPathNew: (aPath: string) => boolean;
  isPathIgnored: (aPath: string) => boolean;
  getDirectoryStatus: (aPath: string) => number;
  getPathStatus: (aPath: string) => number;
  getCachedPathStatus: (aPath: string) => ?number;
  isStatusModified: (status: number) => boolean;
  isStatusNew: (status: number) => boolean;

  // Retrieving Diffs
  getDiffStats: (filePath: string) => {added: number; deleted: number;};
  getLineDiffs: (aPath: string, text: string) => Array<RepositoryLineDiff>;

  // Checking Out
  checkoutHead: (aPath: string) => boolean;
  checkoutReference: (reference: string, create: boolean) => boolean;
}

// One of text or snippet is required.
// TODO(hansonw): use a union + intersection type
type atom$AutocompleteSuggestion = {
  text?: string,
  snippet?: string,
  replacementPrefix?: string;
  type?: ?string;
  leftLabel?: ?string;
  leftLabelHTML?: ?string;
  rightLabel?: ?string;
  rightLabelHTML?: ?string;
  className?: ?string;
  iconHTML?: ?string;
  description?: ?string;
  descriptionMoreURL?: ?string;
};

type atom$AutocompleteRequest = {
  editor: TextEditor;
  bufferPosition: atom$Point;
  scopeDescriptor: string;
  prefix: string;
  activatedManually: boolean;
}

type atom$AutocompleteProvider = {
  selector: string;
  getSuggestions:
      (request: atom$AutocompleteRequest) => Promise<?Array<atom$AutocompleteSuggestion>>;
  disableForSelector?: string;
  inclusionPriority?: number;
  excludeLowerPriority?: boolean;
}

// Undocumented API.
declare class atom$Token {
  value: string;
  matchesScopeSelector(selector: string): boolean;
}

declare class atom$Selection {
  getText(): string;
}
