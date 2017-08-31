/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

/**
 * Private Classes
 */

// Octicons v4.4.0. List extracted from the atom-styleguide package.
type atom$Octicon = 'alert' | 'alignment-align' | 'alignment-aligned-to' | 'alignment-unalign' |
  'arrow-down' | 'arrow-left' | 'arrow-right' | 'arrow-small-down' | 'arrow-small-left' |
  'arrow-small-right' | 'arrow-small-up' | 'arrow-up' | 'beaker' | 'beer' | 'bell' | 'bold' |
  'book' | 'bookmark' | 'briefcase' | 'broadcast' | 'browser' | 'bug' | 'calendar' | 'check' |
  'checklist' | 'chevron-down' | 'chevron-left' | 'chevron-right' | 'chevron-up' | 'circle-slash' |
  'circuit-board' | 'clippy' | 'clock' | 'cloud-download' | 'cloud-upload' | 'code' | 'color-mode' |
  'comment' | 'comment-add' | 'comment-discussion' | 'credit-card' | 'dash' | 'dashboard' |
  'database' | 'desktop-download' | 'device-camera' | 'device-camera-video' | 'device-desktop' |
  'device-mobile' | 'diff' | 'diff-added' | 'diff-ignored' | 'diff-modified' | 'diff-removed' |
  'diff-renamed' | 'ellipses' | 'ellipsis' | 'eye' | 'eye-unwatch' | 'eye-watch' | 'file' |
  'file-add' | 'file-binary' | 'file-code' | 'file-directory' | 'file-directory-create' |
  'file-media' | 'file-pdf' | 'file-submodule' | 'file-symlink-directory' | 'file-symlink-file' |
  'file-text' | 'file-zip' | 'flame' | 'fold' | 'gear' | 'gift' | 'gist' | 'gist-fork' |
  'gist-new' | 'gist-private' | 'gist-secret' | 'git-branch' | 'git-branch-create' |
  'git-branch-delete' | 'git-commit' | 'git-compare' | 'git-fork-private' | 'git-merge' |
  'git-pull-request' | 'git-pull-request-abandoned' | 'globe' | 'grabber' | 'graph' | 'heart' |
  'history' | 'home' | 'horizontal-rule' | 'hourglass' | 'hubot' | 'inbox' | 'info' |
  'issue-closed' | 'issue-opened' | 'issue-reopened' | 'italic' | 'jersey' | 'jump-down' |
  'jump-left' | 'jump-right' | 'jump-up' | 'key' | 'keyboard' | 'law' | 'light-bulb' | 'link' |
  'link-external' | 'list-ordered' | 'list-unordered' | 'location' | 'lock' | 'log-in' | 'log-out' |
  'logo-gist' | 'logo-github' | 'mail' | 'mail-read' | 'mail-reply' | 'mark-github' | 'markdown' |
  'megaphone' | 'mention' | 'microscope' | 'milestone' | 'mirror' | 'mirror-private' |
  'mirror-public' | 'mortar-board' | 'move-down' | 'move-left' | 'move-right' | 'move-up' | 'mute' |
  'no-newline' | 'octoface' | 'organization' | 'package' | 'paintcan' | 'pencil' | 'person' |
  'person-add' | 'person-follow' | 'pin' | 'playback-fast-forward' | 'playback-pause' |
  'playback-play' | 'playback-rewind' | 'plug' | 'plus-small' | 'plus' | 'podium' |
  'primitive-dot' | 'primitive-square' | 'pulse' | 'puzzle' | 'question' | 'quote' | 'radio-tower' |
  'remove-close' | 'reply' | 'repo' | 'repo-clone' | 'repo-create' | 'repo-delete' |
  'repo-force-push' | 'repo-forked' | 'repo-pull' | 'repo-push' | 'repo-sync' | 'rocket' | 'rss' |
  'ruby' | 'screen-full' | 'screen-normal' | 'search' | 'search-save' | 'server' | 'settings' |
  'shield' | 'sign-in' | 'sign-out' | 'smiley' | 'split' | 'squirrel' | 'star' | 'star-add' |
  'star-delete' | 'steps' | 'stop' | 'sync' | 'tag' | 'tag-add' | 'tag-remove' | 'tasklist' |
  'telescope' | 'terminal' | 'text-size' | 'three-bars' | 'thumbsdown' | 'thumbsup' | 'tools' |
  'trashcan' | 'triangle-down' | 'triangle-left' | 'triangle-right' | 'triangle-up' | 'unfold' |
  'unmute' | 'unverified' | 'verified' | 'versions' | 'watch' | 'x' | 'zap';

type atom$PaneLocation = 'left' | 'right' | 'bottom' | 'center';

declare class atom$Model {
  destroy(): void,
  isDestroyed(): boolean,
}

declare class atom$Package {
  path: string,
  activateTime: number,
  mainModule: any,
  metadata: Object,
  name: string,
  loadTime: number,
  getType(): 'atom' | 'textmate' | 'theme',
  hasActivationCommands(): boolean,
  hasActivationHooks(): boolean,
  getActivationHooks(): Array<string>,
  onDidDeactivate(cb: () => mixed): IDisposable,
  activateNow(): void,
  // Undocumented
  getCanDeferMainModuleRequireStorageKey(): string,
}

/**
 * Essential Classes
 */

declare type atom$CustomEvent  = CustomEvent & {
  originalEvent?: Event;
}

type atom$CommandCallback = (event: atom$CustomEvent) => mixed;

declare class atom$CommandRegistry {
  // Methods
  add(
    target: string | HTMLElement,
    commandNameOrCommands: string | {[commandName: string]: atom$CommandCallback},
    callback?: atom$CommandCallback
  ): IDisposable,
  dispatch(target: HTMLElement, commandName: string, detail?: Object): void,
  onDidDispatch(callback: (event: atom$CustomEvent) => mixed): IDisposable,
  onWillDispatch(callback: (event: atom$CustomEvent) => mixed): IDisposable,
}

declare class atom$CompositeDisposable {
  constructor(...disposables: Array<IDisposable>): void,
  dispose(): void,

  add(...disposables: Array<IDisposable>): void,
  remove(disposable: IDisposable): void,
  clear(): void,
}

type atom$ConfigType =
  'boolean' | 'string' | 'integer' | 'number' |
  'array' | 'object' | 'color' | 'any';

type atom$ConfigSchema = {
  default?: mixed,
  description?: string,
  enum?: Array<mixed>,
  maximum?: number,
  minimum?: number,
  properties?: Object,
  title?: string,
  type: Array<atom$ConfigType> | atom$ConfigType,
};

declare class atom$Config {
  // Config Subscription
  observe(
    keyPath: string,
    optionsOrCallback?: Object | (value: any) => void,
    callback?: (value: any) => void
  ): IDisposable,

  onDidChange(
    keyPathOrCallback: string | (event: Object) => void,
    optionsOrCallback?: Object | (event: Object) => void,
    callback?: (event: Object) => void
  ): IDisposable,

  // Managing Settings
  get(
    keyPath?: string,
    options?: {
      excludeSources?: Array<string>,
      sources?: Array<string>,
      scope?: Object,
    }
  ): mixed,

  set(
    keyPath: string,
    value: ?mixed,
    options?: {
      scopeSelector?: string,
      source?: string,
    },
  ): boolean,

  unset(
    keyPath: string,
    options?: {
      scopeSelector?: string,
      source?: string,
    }
  ): void,

  getUserConfigPath(): string,

  // Undocumented Methods
  getRawValue(keyPath: ?string, options: {excludeSources?: string, sources?: string}): mixed,
  getSchema(keyPath: string): atom$ConfigSchema,
  save(): void,
  setRawValue(keyPath: string, value: mixed): void,
  setSchema(
    keyPath: string,
    schema: atom$ConfigSchema,
  ): void,
}

declare class atom$Cursor {
  // Event Subscription
  onDidChangePosition(
    callback: (event: {
      oldBufferPosition: atom$Point,
      oldScreenPosition: atom$Point,
      newBufferPosition: atom$Point,
      newScreenPosition: atom$Point,
      textChanged: boolean,
      Cursor: atom$Cursor,
    }) => mixed,
  ): IDisposable,

  // Managing Cursor Position
  getBufferRow(): number,
  getBufferColumn(): number,
  getBufferPosition(): atom$Point,

  // Cursor Position Details
  // Moving the Cursor

  // Local Positions and Ranges
  getCurrentWordBufferRange(options?: {wordRegex: RegExp}): atom$Range,
  getCurrentWordPrefix(): string,

  // Visibility
  // Comparing to another cursor
  // Utilities
  wordRegExp(options?: {includeNonWordCharacters: boolean}): RegExp,
}

declare class atom$Decoration {
  destroy(): void,
  onDidChangeProperties(
    callback: (event: {oldProperties: Object, newProperties: Object}) => mixed
    ): IDisposable,
  onDidDestroy(callback: () => mixed): IDisposable,
  getMarker(): atom$Marker,
  getProperties(): Object,
  setProperties(properties: mixed): void,
}

declare class atom$DisplayMarkerLayer {
  destroy(): void,
  clear(): void,
  isDestroyed(): boolean,
  markBufferRange(range: atom$Range | atom$RangeLike, options: MarkerOptions): atom$Marker,
  getMarkers(): Array<atom$Marker>,
}

declare class atom$Disposable {
  constructor(disposalAction?: (...args: Array<any>) => any): void,
  dispose(): void,
}

declare class atom$Emitter {
  dispose(): void,
  on(name: string, callback: (v: any) => mixed): IDisposable,
  preempt(name: string, callback: (v: any) => void): IDisposable,
  // This is a flow hack to prevent emitting more than one value.
  // `EventEmitter` allows emitting any number of values - making this a land
  // mine, since we tend to think of `emit` as interchangeable.
  // This hack only works if the extra value is not `undefined`, so this isn't
  // full-proof, but it works for most cases.
  emit(name: string, value: any, ...no_extra_args_allowed: Array<void>): void,
}

declare class atom$Gutter {
  name: string,
  destroy(): void,
  decorateMarker(
    marker: atom$Marker,
    options?: {'class'?: string, item?: Object | HTMLElement},
  ): atom$Decoration,
  show(): void,
  hide(): void,
  onDidDestroy(callback: () => void): IDisposable,
}

declare class atom$Marker {
  destroy(): void,
  getBufferRange(): atom$Range,
  getStartBufferPosition(): atom$Point,
  onDidChange(callback: (event: {
    oldHeadScreenPosition: atom$Point,
    newHeadScreenPosition: atom$Point,
    oldTailScreenPosition: atom$Point,
    newTailScreenPosition: atom$Point,

    oldHeadBufferPosition: atom$Point,
    newHeadBufferPosition: atom$Point,
    oldTailBufferPosition: atom$Point,
    newTailBufferPosition: atom$Point,

    isValid: boolean,
    textChanged: boolean,
  }) => void): IDisposable,
  isValid(): boolean,
  isDestroyed(): boolean,
  onDidDestroy(callback: () => mixed): IDisposable,
  setBufferRange(
    range: atom$RangeLike,
    properties?: {reversed: boolean},
  ): void,
  id: number,
}

declare class atom$ServiceHub {
  provide<T>(keyPath: string, version: string, service: T): IDisposable,
  consume<T>(
    keyPath: string,
    versionRange: string,
    callback: (provider: T) => mixed
  ): IDisposable,
}

type atom$PackageMetadata = {
  name: string,
  version: string,
};

declare class atom$PackageManager {
  // Event Subscription
  onDidLoadInitialPackages(callback: () => void): IDisposable,
  onDidActivateInitialPackages(callback: () => void): IDisposable,
  onDidActivatePackage(callback: (pkg: atom$Package) => mixed): IDisposable,
  onDidDeactivatePackage(callback: (pkg: atom$Package) => mixed): IDisposable,
  onDidLoadPackage(callback: (pkg: atom$Package) => mixed): IDisposable,
  onDidTriggerActivationHook(activationHook: string, callback: () => mixed): IDisposable,

  // Package system data
  getApmPath(): string,
  getPackageDirPaths(): Array<string>,

  // General package data
  resolvePackagePath(name: string): ?string,
  isBundledPackage(name: string): boolean,

  // Enabling and disabling packages
  enablePackage(name: string): ?atom$Package,
  disablePackage(name: string): ?atom$Package,
  isPackageDisabled(name: string): boolean,

  // Accessing active packages
  getActivePackage(name: string): ?atom$Package,
  getActivePackages(): Array<atom$Package>,
  isPackageActive(name: string): boolean,

  // Activating and deactivating packages
  activatePackage(name: string): Promise<atom$Package>,

  // Accessing loaded packages
  getLoadedPackage(name: string): ?atom$Package,
  getLoadedPackages(): Array<atom$Package>,
  isPackageLoaded(name: string): boolean,

  // Accessing available packages
  getAvailablePackageNames(): Array<string>,
  getAvailablePackageMetadata(): Array<atom$PackageMetadata>,

  // (Undocumented.)
  activate(): Promise<any>,
  deactivatePackages(): void,
  deactivatePackage(name: string, suppressSerialization?: boolean): void,
  emitter: atom$Emitter,
  loadPackage(name: string): void,
  loadPackages(): void,
  serializePackage(pkg: atom$Package): void,
  serviceHub: atom$ServiceHub,
  packageDirPaths: Array<string>,
  triggerActivationHook(hook: string): void,
  triggerDeferredActivationHooks(): void,
  unloadPackage(name: string): void,
  unloadPackages(): void,
}

declare class atom$StyleManager {
  // Event Subscription

  // Reading Style Elements
  getStyleElements(): Array<HTMLStyleElement>,

  // Paths
  getUserStyleSheetPath(): string,

  // (Undocumented.)
  addStyleSheet(
    source: string,
    params: {
      sourcePath?: string,
      context?: boolean,
      priority?: number,
      skipDeprecatedSelectorsTransformation?: boolean
    }
  ): IDisposable,
}

type atom$PaneSplitParams = {
  copyActiveItem?: boolean,
  items?: Array<Object>,
};

type atom$PaneSplitOrientation = 'horizontal' | 'vertical';
type atom$PaneSplitSide = 'before' | 'after';

// Undocumented class
declare class atom$applicationDelegate {
  focusWindow(): Promise<mixed>,
}

type atom$PaneParams = {
  activeItem?: Object,
  applicationDelegate: atom$applicationDelegate,
  focused?: boolean,
  container: Object,
  config: atom$Config,
  notificationManager: atom$NotificationManager,
  deserializerManager: atom$DeserializerManager,
  items?: Array<Object>,
  itemStackIndices?: Array<number>,
  flexScale?: number,
};

declare class atom$Pane {
  // Items
  addItem(item: Object, options?: {index?: number, pending?: boolean}): Object,
  getItems(): Array<Object>,
  getActiveItem(): ?Object,
  itemAtIndex(index: number): ?Object,
  getActiveItemIndex(): number,
  activateItem(item: Object): ?Object,
  activateItemAtIndex(index: number): void,
  moveItemToPane(item: Object, pane: atom$Pane, index: number): void,
  destroyItem(item: Object, force?: boolean): boolean | Promise<boolean>,
  itemForURI(uri: string): Object,

  // Event subscriptions.
  onDidAddItem(cb: (event: {item: Object, index: number}) => void): IDisposable,
  onDidRemoveItem(cb: (event: {item: Object, index: number}) => void): IDisposable,
  onWillRemoveItem(cb: (event: {item: Object, index: number}) => void): IDisposable,
  onDidDestroy(cb: () => void): IDisposable,
  onDidChangeFlexScale(cb: (newFlexScale: number) => void): IDisposable,
  onWillDestroy(cb: () => void): IDisposable,
  observeActiveItem(cb: (item: ?Object) => void): IDisposable,

  // Lifecycle
  isActive(): boolean,
  activate(): void,
  destroy(): void,

  // Splitting
  splitLeft(params?: atom$PaneSplitParams): atom$Pane,
  splitRight(params?: atom$PaneSplitParams): atom$Pane,
  splitUp(params?: atom$PaneSplitParams): atom$Pane,
  splitDown(params?: atom$PaneSplitParams): atom$Pane,
  split(
    orientation: atom$PaneSplitOrientation,
    side: atom$PaneSplitSide,
    params?: atom$PaneSplitParams,
  ): atom$Pane,

  // Undocumented Methods
  constructor(params: atom$PaneParams): atom$Pane,
  clearPendingItem(): void,
  getFlexScale(): number,
  getParent(): Object,
  removeItem(item: Object, moved: ?boolean): void,
  setActiveItem(item: Object): Object,
  setFlexScale(flexScale: number): number,
  getContainer(): atom$PaneContainer,

  element: HTMLElement,
}

declare type atom$PaneItem = {
  // These are all covariant, meaning that these props are read-only. Therefore we can assign an
  // object with more strict requirements to an variable of this type.
  +getTitle: () => string,
  +getLongTitle?: () => string,
  +getIconName?: () => string,
  +getURI?: () => string,
  +onDidChangeIcon?: (cb: (icon: string) => void) => IDisposable,
  +onDidChangeTitle?: (cb: (title: string) => void) => IDisposable,
  +serialize?: () => Object,
}

// Undocumented class
declare class atom$PaneAxis {
  getFlexScale(): number,
  setFlexScale(flexScale: number): number,
  getItems(): Array<Object>,
}

// Undocumented class
declare class atom$PaneContainer {
  constructor({
    config: atom$Config,
    applicationDelegate: atom$applicationDelegate,
    notificationManager: atom$NotificationManager,
    deserializerManager: atom$DeserializerManager,
  }): atom$PaneContainer,
  destroy(): void,
  getActivePane(): atom$Pane,
  getActivePaneItem(): ?Object,
  getLocation(): atom$PaneLocation,
  getPanes(): Array<atom$Pane>,
  getPaneItems(): Array<atom$PaneItem>,
  observePanes(cb: (pane: atom$Pane) => void): IDisposable,
  onDidAddPane(cb: (event: {pane: atom$Pane}) => void): IDisposable,
  onDidDestroyPane(cb: (event: {pane: atom$Pane}) => void): IDisposable,
  onWillDestroyPane(cb: (event: {pane: atom$Pane}) => void): IDisposable,
  onDidAddPaneItem(cb: (item: atom$PaneItem) => void): IDisposable,
  onDidDestroyPaneItem(cb: (item: atom$Pane) => void): IDisposable,
  paneForItem(item: Object): ?atom$Pane,
  serialize(): Object,
}

declare class atom$Panel {
  // Construction and Destruction
  destroy(): void,

  // Event Subscription
  onDidChangeVisible(callback: (visible: boolean) => any): IDisposable,
  onDidDestroy(callback: (panel: atom$Panel) => any): IDisposable,

  // Panel Details
  getElement(): HTMLElement,
  getItem(): any,
  getPriority(): number,
  isVisible(): boolean,
  hide(): void,
  show(): void,
}

type atom$PointObject = {row: number, column: number};

type atom$PointLike = atom$Point
| [number, number]
| atom$PointObject;

declare class atom$Point {
  static fromObject(object: atom$PointLike, copy: ? boolean): atom$Point,
  constructor(row: number, column: number): void,
  row: number,
  column: number,
  copy(): atom$Point,
  negate(): atom$Point,

  // Comparison
  min(point1: atom$PointLike, point2: atom$PointLike): atom$Point,
  compare(other: atom$PointLike): -1 | 0 | 1,
  isEqual(otherRange: atom$PointLike): boolean,
  isLessThan(other: atom$PointLike): boolean,
  isLessThanOrEqual(other: atom$PointLike): boolean,
  isGreaterThan(other: atom$PointLike): boolean,
  isGreaterThanOrEqual(other: atom$PointLike): boolean,

  // Operations
  translate(other: atom$PointLike): atom$Point,

  // Conversion
  serialize(): Array<number>,
  toArray(): Array<number>,
}

type atom$RangeObject = {
  start: atom$PointObject,
  end: atom$PointObject,
};

type atom$RangeLike = atom$Range
  | atom$RangeObject // TODO: Flow doesn't really handle the real signature below...
  | [atom$PointLike, atom$PointLike]
  | {
    start: atom$PointLike,
    end: atom$PointLike,
  };

declare class atom$Range {
  static fromObject(
    object: atom$RangeLike,
    copy?: boolean,
  ): atom$Range,
  constructor(pointA: atom$PointLike, pointB: atom$PointLike): void,
  compare(other: atom$Range): number,
  start: atom$Point,
  end: atom$Point,
  isEmpty(): boolean,
  isEqual(otherRange: atom$RangeLike): boolean,
  intersectsWith(otherRange: atom$RangeLike, exclusive?: boolean): boolean,
  containsPoint(point: atom$PointLike, exclusive?: boolean): boolean,
  containsRange(other: atom$Range, exclusive?: boolean): boolean,
  union(other: atom$Range): atom$Range,
  serialize(): Array<Array<number>>,
  translate(startDelta: atom$PointLike, endDelta?: atom$PointLike): atom$Range,
  getRowCount(): number,
}

type RawStatusBarTile = {
  item: HTMLElement,
  priority: number,
};

type atom$StatusBarTile = {
  getPriority(): number,
  getItem(): HTMLElement,
  destroy(): void,
};

declare class atom$ScopeDescriptor {
  constructor(object: {scopes: Array<string>}): void,
  getScopesArray(): Array<string>,
}

/**
 * This API is defined at https://github.com/atom/status-bar.
 */
declare class atom$StatusBar {
  addLeftTile(tile: RawStatusBarTile): atom$StatusBarTile,
  addRightTile(tile: RawStatusBarTile): atom$StatusBarTile,
  getLeftTiles(): Array<atom$StatusBarTile>,
  getRightTiles(): Array<atom$StatusBarTile>,
}

// https://github.com/atom/atom/blob/v1.9.0/src/text-editor-registry.coffee
declare class atom$TextEditorRegistry {
  add(editor: atom$TextEditor): IDisposable,
  remove(editor: atom$TextEditor): boolean,
  observe(callback: (editor: atom$TextEditor) => void): IDisposable,

  // Added in 1.11.0 (These are typed optional until older Atoms are dropped)
  build?: (params: atom$TextEditorParams) => atom$TextEditor,

  // Private
  editors: Set<atom$TextEditor>,
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
  onDidChangeActiveThemes(callback: () => mixed): IDisposable,

  // Accessing Loaded Themes
  getLoadedThemeNames(): Array<string>,
  getLoadedThemes(): Array<mixed>, // TODO: Define undocumented ThemePackage class.

  // Accessing Active Themes
  getActiveThemeNames(): Array<string>,
  getActiveThemes(): Array<mixed>, // TODO: Define undocumented ThemePackage class.

  // Managing Enabled Themes
  getEnabledThemeNames(): Array<string>,

  // Private
  activateThemes(): Promise<any>,
  requireStylesheet(stylesheetPath: string): IDisposable,
}

type atom$TooltipsPlacementOption = 'top' | 'bottom' | 'left' | 'right' | 'auto';

type atom$TooltipsAddOptions = {
  title?: string,
  item?: HTMLElement,
  keyBindingCommand?: string,
  keyBindingTarget?: HTMLElement,
  animation?: boolean,
  container?: string | false,
  delay?: number | {show: number, hide: number},
  placement?: atom$TooltipsPlacementOption | () => atom$TooltipsPlacementOption,
  trigger?: string,
};

type atom$Tooltip = {
  hide(): void;
  getTooltipElement(): HTMLElement,
};

declare class atom$TooltipManager {
  tooltips: Map<HTMLElement, Array<atom$Tooltip>>;
  add(
    target: HTMLElement,
    options: atom$TooltipsAddOptions,
  ): IDisposable,
}

type InsertTextOptions = {
  select: boolean,
  autoIndent: boolean,
  autoIndentNewline: boolean,
  autoDecreaseIndent: boolean,
  normalizeLineEndings: ?boolean,
  undo: string,
};

type DecorateMarkerParams = {
  type: 'line',
  class: string,
  onlyHead?: boolean,
  onlyEmpty?: boolean,
  onlyNonEmpty?: boolean,
} | {
  type: 'gutter',
  item?: HTMLElement,
  class?: string,
  onlyHead?: boolean,
  onlyEmpty?: boolean,
  onlyNonEmpty?: boolean,
  gutterName?: string,
} | {
  type: 'highlight',
  class?: string,
  gutterName?: string,
} | {
  type: 'overlay',
  item: Object,
  position?: 'head' | 'tail', // Defaults to 'head' when unspecified.
} | {
  type: 'block',
  item: HTMLElement,
  position?: 'before' | 'after', // Defaults to 'before' when unspecified.
};

type ChangeCursorPositionEvent = {
  oldBufferPosition: atom$Point,
  oldScreenPosition: atom$Point,
  newBufferPosition: atom$Point,
  newScreenPosition: atom$Point,
  textChanged: boolean,
  cursor: atom$Cursor,
};

type MarkerOptions = {|
  reversed?: boolean,
  tailed?: boolean,
  invalidate?: 'never' | 'surround' | 'overlap' | 'inside' | 'touch',
  exclusive?: boolean,
|};

declare class atom$TextEditor extends atom$Model {
  id: number,

  // Event Subscription
  onDidChange(callback: () => void): IDisposable,
  onDidChangePath(callback: (newPath: string) => mixed): IDisposable,
  onDidStopChanging(callback: () => void): IDisposable,
  onDidChangeCursorPosition(callback: (event: ChangeCursorPositionEvent) => mixed):
    IDisposable,
  onDidDestroy(callback: () => mixed): IDisposable,
  onDidSave(callback: (event: {path: string}) => mixed): IDisposable,
  getBuffer(): atom$TextBuffer,
  observeGrammar(callback: (grammar: atom$Grammar) => mixed): IDisposable,
  onWillInsertText(callback: (event: {cancel: () => void, text: string}) => void):
      IDisposable,
  // Note that the range property of the event is undocumented.
  onDidInsertText(callback: (event: {text: string, range: atom$Range}) => mixed): IDisposable,
  onDidChangeSoftWrapped(callback: (softWrapped: boolean) => mixed): IDisposable,

  // File Details
  getTitle: () => string,
  getLongTitle(): string,
  /**
   * If you open Atom via Spotlight such that it opens with a tab named
   * "untitled" that does not correspond to a file on disk, this will return
   * null.
   */
  getPath(): ?string,
  getURI: () => ?string,
  insertNewline(): void,
  isModified: () => boolean,
  isEmpty(): boolean,
  getEncoding(): buffer$Encoding,
  setEncoding(encoding: string): void,
  getTabLength() : number,
  getSoftTabs(): boolean,

  // File Operations
  save(): void,
  // DO NOT USE: Doesn't work with remote text buffers!
  // saveAs(filePath: string): void,

  // Reading Text
  getText(): string,
  getTextInBufferRange(range: atom$RangeLike): string,
  getLineCount(): number,

  // Mutating Text
  setText(text: string, options?: InsertTextOptions): void,
  setTextInBufferRange(
    range: atom$Range | Array<atom$Point>,
    text: string,
    options?: {
      normalizeLineEndings?: boolean,
      undo?: string,
    },
  ): atom$Range,
  insertText(text: string): Array<atom$Range> | false,
  delete: () => void,
  backspace: () => void,
  duplicateLines: () => void,

  // History
  createCheckpoint(): atom$TextBufferCheckpoint,
  revertToCheckpoint(checkpoint: atom$TextBufferCheckpoint): boolean,
  transact(fn: () => mixed, _: void): void,
  transact(groupingInterval: number, fn: () => mixed): void,

  // TextEditor Coordinates
  screenPositionForBufferPosition(
    bufferPosition: atom$PointLike,
    options?: {
      wrapBeyondNewlines?: boolean,
      wrapAtSoftNewlines?: boolean,
      screenLine?: boolean,
    },
  ): atom$Point,
  bufferPositionForScreenPosition(
    screenPosition: atom$PointLike,
    options?: {
      wrapBeyondNewlines?: boolean,
      wrapAtSoftNewlines?: boolean,
      screenLine?: boolean,
    },
  ): atom$Point,
  getVisibleRowRange(): ?[number, number],

  // Decorations
  decorateMarker(marker: atom$Marker, decorationParams: DecorateMarkerParams): atom$Decoration,
  decorationsForScreenRowRange(
    startScreenRow: number,
    endScreenRow: number,
  ): {[markerId: string]: Array<Object>},
  getDecorations(options?: {class?: string, type?: string}): Array<atom$Decoration>,

  // Markers
  getDefaultMarkerLayer(): atom$DisplayMarkerLayer,
  markBufferPosition(position: atom$PointLike, options?: MarkerOptions): atom$Marker,
  markBufferRange(range: atom$RangeLike, options?: MarkerOptions): atom$Marker,
  markScreenRange(range: atom$RangeLike, options?: MarkerOptions): atom$Marker,
  markScreenPosition(position: atom$PointLike, options?: MarkerOptions): atom$Marker,

  // Cursors
  getCursors(): Array<atom$Cursor>,
  setCursorBufferPosition(
    position: atom$PointLike,
    options?: {
      autoscroll?: boolean,
      wrapBeyondNewlines?: boolean,
      wrapAtSoftNewlines?: boolean,
      screenLine?: boolean,
    }): void,
  getCursorBufferPosition(): atom$Point,
  getCursorBufferPositions(): Array<atom$Point>,
  getCursorScreenPosition(): atom$Point,
  getCursorScreenPositions(): Array<atom$Point>,
  getLastCursor(): atom$Cursor,
  addCursorAtBufferPosition(point: atom$PointLike): atom$Cursor,
  moveToBeginningOfLine(): void,
  moveToEndOfLine(): void,
  moveToBottom(): void,

  // Selections
  getSelectedText(): string,
  selectAll(): void,
  getSelectedBufferRange(): atom$Range,
  getSelectedBufferRanges(): Array<atom$Range>,
  getSelections(): Array<atom$Selection>,
  selectToBufferPosition(point: atom$Point): void,
  setSelectedBufferRange(
    bufferRange: atom$Range,
    options?: {
      reversed?: boolean,
      preserveFolds?: boolean,
    },
  ): void,
  setSelectedBufferRanges(
    bufferRanges: Array<atom$Range>,
    options?: {
      reversed?: boolean,
      preserveFolds?: boolean,
    },
  ): void,

  // Folds
  unfoldAll(): void,

  // Searching and Replacing
  scanInBufferRange(
    regex: RegExp,
    range: atom$Range,
    iterator: (foundMatch: {
      match: mixed,
      matchText: string,
      range: atom$Range,
      stop: () => mixed,
      replace: (replaceWith: string) => mixed,
    }) => mixed
  ): void,

  scan(
    regex: RegExp,
    iterator: (foundMatch: {
      match: mixed,
      matchText: string,
      range: atom$Range,
      stop: () => mixed,
      replace: (replaceWith: string) => mixed,
    }) => mixed
  ): void,

  // Tab Behavior
  // Soft Wrap Behavior
  // Indentation
  indentationForBufferRow(bufferRow: number): number,
  setTabLength(tabLength: number): void,
  setSoftTabs(softTabs: boolean): void,

  lineTextForBufferRow(bufferRow: number): string,

  // Grammars
  getGrammar(): atom$Grammar,
  setGrammar(grammar: ?atom$Grammar): void,

  // Clipboard Operations
  pasteText: (options?: Object) => void,

  // Managing Syntax Scopes
  scopeDescriptorForBufferPosition(
    bufferPosition: atom$PointLike,
  ): atom$ScopeDescriptor,

  // Gutter
  addGutter(options: {
    name: string,
    priority?: number,
    visible?: boolean,
  }): atom$Gutter,
  observeGutters(callback: (gutter: atom$Gutter) => void): IDisposable,
  getGutters(): Array<atom$Gutter>,
  gutterWithName(name: string): ?atom$Gutter,

  // Scrolling the TextEditor
  scrollToBufferPosition(
    position: atom$Point | [?number, ?number],
    options?: {center?: boolean}
  ): void,
  scrollToScreenPosition(
    position: atom$Point | [?number, ?number],
    options?: {center?: boolean}
  ): void,
  scrollToBottom(): void,
  scrollToTop(): void,

  // TextEditor Rendering
  getPlaceholderText(): string,
  setPlaceholderText(placeholderText: string): void,

  // This is undocumented, but Nuclide uses it in the AtomTextEditor wrapper.
  setLineNumberGutterVisible(lineNumberGutterVisible: boolean): void,

  // Editor Options
  setSoftWrapped(softWrapped: boolean): void,

  isFoldedAtBufferRow(row: number): boolean,
  getLastBufferRow(): number,

  // Undocumented Methods
  getElement(): HTMLElement,
  getDefaultCharWidth(): number,
  getLineHeightInPixels(): number,
  moveToTop(): void,
  tokenForBufferPosition(position: atom$Point | [?number, ?number]): atom$Token,
  onDidConflict(callback: () => void): IDisposable,
  serialize: () => mixed,
  foldBufferRowRange(startRow: number, endRow: number): void,
  getNonWordCharacters(scope?: atom$ScopeDescriptor): string,
}

/**
 * This is not part of the official Atom 1.0 API. Nevertheless, we need to reach into this object
 * via `atom$TextEditorElement` to do some things that we have no other way to do.
 */
declare class atom$TextEditorComponent {
  domNode: HTMLElement,
  scrollViewNode: HTMLElement,
  presenter: atom$TextEditorPresenter,
  refs: atom$TextEditorComponentRefs,
  linesComponent: atom$LinesComponent,
  // NOTE: This is typed as a property to allow overwriting.
  startCursorBlinking: () => void,
  stopCursorBlinking(): void,
  pixelPositionForScreenPosition(
    screenPosition: atom$Point,
    clip?: boolean,
  ): {top: number, left: number},
  screenPositionForMouseEvent(event: MouseEvent): atom$Point,
  pixelPositionForMouseEvent(
    event: MouseEvent,
    linesClientRect?: {top: number, left: number, bottom: number, right: number},
  ): {top: number, left: number, bottom: number, right: number},
  invalidateBlockDecorationDimensions(decoration: atom$Decoration): void,
}

/**
 * This is not part of the official Atom 1.0 API. Nevertheless, we need to reach into this object
 * via `atom$TextEditorComponent` to do some things that we have no other way to do.
 */
declare class atom$TextEditorPresenter {
  startBlinkingCursors: () => void,
  stopBlinkingCursors(visible: boolean): void,
  updateLineNumberGutterState(): void,
}

/**
 * This is not part of the official Atom 1.0 API. Nevertheless, we need it to access
 * the deepest dom element receiving DOM events.
 */
declare class atom$LinesComponent {
  domNode: HTMLElement,
  getDomNode(): HTMLElement,
}

/**
 * This is not part of the official Atom 1.0 API. Nevertheless, we need it to access
 * the deepest dom element receiving DOM events.
 */
declare class atom$TextEditorComponentRefs {
  lineTiles: HTMLElement,
}

/**
 * This is not part of the official Atom 1.0 API, but it really should be. This is the element that
 * is returned when you run `atom.views.getView(<TextEditor>)`.
 */
declare class atom$TextEditorElement extends HTMLElement {
  component: ?atom$TextEditorComponent,
  getModel(): atom$TextEditor,
  setModel(model: atom$TextEditor): void,
  pixelPositionForBufferPosition(
    bufferPosition: atom$PointLike,
  ): {top: number, left: number},
  pixelPositionForScreenPosition(screenPosition: atom$Point): {
    left: number,
    top: number,
  },

  setScrollTop(scrollTop: number): void,
  getScrollTop(): number,

  setScrollLeft(scrollLeft: number): void,
  getScrollLeft(): number,

  getScrollHeight(): number,
  getHeight(): number,

  onDidChangeScrollTop(callback: (scrollTop: number) => mixed): IDisposable,
  onDidChangeScrollLeft(callback: (scrollLeft: number) => mixed): IDisposable,

  // Called when the editor is attached to the DOM.
  onDidAttach(callback: () => mixed): IDisposable,
  // Called when the editor is detached from the DOM.
  onDidDetach(callback: () => mixed): IDisposable,

  // Undocumented Methods

  // `undefined` means no explicit width. `null` sets a zero width (which is almost certainly a
  // mistake) so we don't allow it.
  setWidth(width: number | void): void,
}

declare class atom$ViewProvider {
  modelConstructor: Function,
}

declare class atom$ViewRegistry {
  // Methods
  addViewProvider(
    modelConstructor: any,
    createView?: (...args: Array<any>) => ?HTMLElement
  ): IDisposable,
  getView(textEditor: atom$TextEditor): atom$TextEditorElement,
  getView(notification: atom$Notification): HTMLElement,
  getView(gutter: atom$Gutter): HTMLElement,
  getView(panel: atom$Panel): HTMLElement,
  getView(workspace: atom$Workspace): HTMLElement,
  getView(object: Object): HTMLElement,
  providers: Array<atom$ViewProvider>,
}

type atom$WorkspaceAddPanelOptions = {
  item: Object,
  visible?: boolean,
  priority?: number,
  className?: string,
};

type atom$TextEditorParams = {
  buffer?: atom$TextBuffer,
  lineNumberGutterVisible?: boolean,
};

type DestroyPaneItemEvent = {
  item: atom$PaneItem,
  pane: atom$Pane,
  index: number,
};

type AddPaneItemEvent = {
  item: atom$PaneItem,
  pane: atom$Pane,
  index: number,
};

type OnDidOpenEvent = {
  uri: string,
  item: mixed,
  pane: atom$Pane,
  index: number,
};

type AddTextEditorEvent = {
  textEditor: atom$TextEditor,
  pane: atom$Pane,
  index: number,
};

declare class atom$Workspace {
  // Event Subscription
  observePanes(cb: (pane: atom$Pane) => void): IDisposable,
  observeTextEditors(callback: (editor: atom$TextEditor) => mixed): IDisposable,
  onDidAddTextEditor(callback: (event: AddTextEditorEvent) => mixed): IDisposable,
  onDidChangeActivePaneItem(callback: (item: mixed) => mixed): IDisposable,
  onDidDestroyPaneItem(callback: (event: DestroyPaneItemEvent) => mixed): IDisposable,
  onDidAddPaneItem(callback: (event: AddPaneItemEvent) => mixed): IDisposable,
  observeActivePaneItem(callback: (item: ?mixed) => mixed): IDisposable,
  onDidStopChangingActivePaneItem(callback: (item: ?mixed) => mixed): IDisposable,
  observePaneItems(callback: (item: mixed) => mixed): IDisposable,
  onWillDestroyPaneItem(
    callback: (event: {item: mixed, pane: mixed, index: number}) => mixed
  ): IDisposable,
  onDidOpen(callback: (event: OnDidOpenEvent) => mixed): IDisposable,

  getElement(): HTMLElement,

  // Opening
  open(
    uri?: string,
    options?: {
      activePane?: boolean,
      initialLine?: number,
      initialColumn?: number,
      pending?: boolean,
      split?: string,
      searchAllPanes?: boolean,
    }
  ): Promise<atom$TextEditor>,
  openURIInPane(
    uri?: string,
    pane: atom$Pane,
    options?: {
      initialLine?: number,
      initialColumn?: number,
      activePane?: boolean,
      searchAllPanes?: boolean,
    }
  ): Promise<atom$TextEditor>,
  isTextEditor(item: ?mixed): boolean,
  /* Optional method because this was added post-1.0. */
  buildTextEditor: ((params: atom$TextEditorParams) => atom$TextEditor),
  /* Optional method because this was added in 1.9.0 */
  handleGrammarUsed?: (grammar: atom$Grammar) => void,
  reopenItem(): Promise<?atom$TextEditor>,
  addOpener(callback: (uri: string) => any): IDisposable,
  hide(uriOrItem: string | Object): void,
  toggle(uriOrItem: string | Object): void,

  // Pane Containers
  getPaneContainers(): Array<atom$PaneContainer>,
  paneContainerForItem(item: ?mixed): ?atom$PaneContainer,

  // Pane Items
  getPaneItems(): Array<Object>,
  getActivePaneItem(): ?Object,
  getTextEditors(): Array<atom$TextEditor>,
  getActiveTextEditor(): ?atom$TextEditor,

  // Panes
  getPanes(): Array<atom$Pane>,
  getActivePane(): atom$Pane,
  activateNextPane(): boolean,
  activatePreviousPane(): boolean,
  paneForURI(uri: string): atom$Pane,
  paneForItem(item: mixed): ?atom$Pane,

  // Panels
  panelContainers: {[location: string]: atom$PanelContainer},
  getBottomPanels(): Array<atom$Panel>,
  addBottomPanel(options: atom$WorkspaceAddPanelOptions): atom$Panel,
  getLeftPanels(): Array<atom$Panel>,
  addLeftPanel(options: atom$WorkspaceAddPanelOptions): atom$Panel,
  getRightPanels(): Array<atom$Panel>,
  addRightPanel(options: atom$WorkspaceAddPanelOptions): atom$Panel,
  getTopPanels(): Array<atom$Panel>,
  addTopPanel(options: atom$WorkspaceAddPanelOptions): atom$Panel,
  getModalPanels(): Array<atom$Panel>,
  addModalPanel(options: atom$WorkspaceAddPanelOptions): atom$Panel,

  getLeftDock(): atom$Dock,
  getRightDock(): atom$Dock,
  getBottomDock(): atom$Dock,
  getCenter(): atom$WorkspaceCenter,

  // Searching and Replacing
  scan(
    regex: RegExp,
    options: {
      paths?: Array<string>,
      onPathsSearched?: (numSearched: number) => mixed,
      leadingContextLineCount?: number,
      trailingContextLineCount?: number,
    },
    iterator: (
      ?{
        filePath: string,
        matches: Array<{
          leadingContextLines: Array<string>,
          lineText: string,
          lineTextOffset: number,
          range: atom$RangeLike,
          matchText: string,
          trailingContextLines: Array<string>,
        }>,
      },
      Error,
    ) => mixed,
  ): Promise<?string>,

  destroyActivePaneItemOrEmptyPane(): void,
  destroyActivePaneItem(): void,
}

declare class atom$AbstractPaneContainer {
  isVisible(): boolean,
  show(): void,
  hide(): void,
  getActivePane(): atom$Pane,
  getPanes(): Array<atom$Pane>,
  onDidAddPaneItem((item: {item: Object}) => void): IDisposable,
  state: {
    size: number,
  }
}

declare class atom$Dock extends atom$AbstractPaneContainer {
  // This is a woefully incomplete list, items can be added as needed from
  // https://github.com/atom/atom/blob/master/src/dock.js
  toggle(): void,
}

declare class atom$WorkspaceCenter extends atom$AbstractPaneContainer {
  activate(): void;

  // Pane Items
  getPaneItems(): Array<atom$PaneItem>,
  getActivePaneItem(): ?atom$PaneItem,
  getTextEditors(): Array<atom$TextEditor>,
  getActiveTextEditor(): ?atom$TextEditor,

  observeActivePaneItem(callback: atom$PaneItem => mixed): IDisposable;
  onDidChangeActivePaneItem(callback: (item: mixed) => mixed): IDisposable;
  // This should be removed soon anyway, it's currently deprecated.
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
  ): IDisposable,
  // Helper Methods
  kill(): void,
}

declare class atom$Clipboard {
  // Methods
  write(text: string, metadata?: mixed): void,
  read(): string,
  readWithMetadata(): {
    metadata: ?mixed,
    text: string,
  },
}

declare class atom$ContextMenuManager {
  add(itemsBySelector: {[cssSelector: string]: Array<atom$ContextMenuItem>}): IDisposable,
  itemSets: Array<atom$ContextMenuItemSet>,

  // Undocumented methods
  showForEvent(event: Event): void,
  templateForEvent(event: Event): Array<Object>,
}

declare class atom$ContextMenuItemSet {
  items: Array<atom$ContextMenuItem>,
  selector: string,
}

type atom$ContextMenuItem = {
  command?: string,
  created?: (event: MouseEvent) => void,
  enabled?: boolean,
  label?: string,
  shouldDisplay?: (event: MouseEvent) => boolean,
  submenu?: Array<atom$ContextMenuItem>,
  type?: string,
  visible?: boolean,
};

type atom$Deserializer = {
  name: string,
  deserialize: (state: Object) => mixed,
};

declare class atom$DeserializerManager {
  add(...deserializers: Array<atom$Deserializer>): IDisposable,
  deserialize(state: Object, params?: Object): mixed,
}

// Apparently it can sometimes include a `code` property.
declare class atom$GetEntriesError extends Error {
  code?: string,
}

declare class atom$Directory {
  constructor(dirname?: string): atom$Directory,

  symlink: boolean,

  // Construction
  create(mode?: number): Promise<boolean>,

  // Event Subscription
  onDidChange(callback: () => mixed): IDisposable,

  // Directory Metadata
  isFile(): boolean,
  isDirectory(): boolean,
  exists():Promise<boolean>,

  // Managing Paths
  getPath(): string,
  getBaseName(): string,
  relativize(fullPath: string): string,

  // Event Subscription
  onDidRename(callback: () => void): IDisposable,
  onDidDelete(callback: () => void): IDisposable,

  // Traversing
  getParent(): atom$Directory,
  getFile(filename: string): atom$File,
  getSubdirectory(dirname: string): atom$Directory,
  getEntries(
    callback: (
      error: ?atom$GetEntriesError,
      entries: ?Array<atom$Directory | atom$File>,
    ) => mixed): void,
  contains(path: string): boolean,
}

declare class atom$File {
  constructor(filePath?: string, symlink?: boolean): atom$File,

  symlink: boolean,

  // Construction
  create(): Promise<boolean>,

  // Event Subscription
  onDidChange(callback: () => mixed): IDisposable,

  // File Metadata
  isFile(): boolean,
  isDirectory(): boolean,
  exists(): boolean,
  setEncoding(encoding: string): void,
  getEncoding(): string,

  // Event Subscription
  onDidRename(callback: () => void): IDisposable,
  onDidDelete(callback: () => void): IDisposable,
  onDidChange(callback: () => void): IDisposable,

  // Managing Paths
  getPath(): string,
  getBaseName(): string,

  // Traversing
  getParent(): atom$Directory,

  // Reading and Writing
  read(flushCache?: boolean): Promise<string>,
  write(text: string): Promise<void>,
  writeSync(text: string): void,
}

declare class atom$GitRepository extends atom$Repository {
  // Unofficial API.
  statuses: {[filePath: string]: number},
  // Return the `git-utils` async repo.
  getRepo(): atom$GitRepositoryInternal,
}

declare class atom$Grammar {
  name: string,
  scopeName: string,
  tokenizeLines(text: string): Array<Array<atom$GrammarToken>>,
}

type atom$GrammarToken = {
  value: string,
  scopes: Array<string>,
};

declare class atom$GrammarRegistry {
  // Event Subscription
  onDidAddGrammar(callback: (grammar: atom$Grammar) => void): IDisposable,

  // Managing Grammars
  grammarForScopeName(scopeName: string): ?atom$Grammar,
  removeGrammarForScopeName(scopeName: string): ?atom$Grammar,
  loadGrammarSync(grammarPath: string): atom$Grammar,
  selectGrammar(filePath: string, fileContents: string): atom$Grammar,

  // Private API
  clear(): IDisposable,
}

declare class atom$HistoryManager {
  removeProject(paths: Array<string>): void,
  getProjects(): Array<atom$HistoryProject>,
}

declare class atom$HistoryProject {
  get paths(): Array<string>;
  get lastOpened(): Date;
}

type atom$KeyBinding = Object;

declare class atom$KeymapManager {

  // Event Subscription
  onDidMatchBinding(callback: (event: {
    keystrokes: string,
    binding: atom$KeyBinding,
    keyboardEventTarget: HTMLElement,
  }) => mixed): IDisposable,

  onDidPartiallyMatchBinding(callback: (event: {
    keystrokes: string,
    partiallyMatchedBindings: atom$KeyBinding,
    keyboardEventTarget: HTMLElement,
  }) => mixed): IDisposable,

  onDidFailToMatchBinding(callback: (event: {
    keystrokes: string,
    partiallyMatchedBindings: atom$KeyBinding,
    keyboardEventTarget: HTMLElement,
  }) => mixed): IDisposable,

  onDidFailToReadFile(callback: (error: {
    message: string,
    stack: string,
  }) => mixed): IDisposable,

  // Adding and Removing Bindings
  add(source: string, bindings: Object): void,

  // Accessing Bindings
  getKeyBindings(): Array<atom$KeyBinding>,
  findKeyBindings(params: {
    keystrokes?: string,
    command?: string,
    target?: HTMLElement,
  }): Array<atom$KeyBinding>,

  // Managing Keymap Files
  loadKeymap(path: string, options?: {watch: boolean}): void,
  watchKeymap(path: string): void,

  // Managing Keyboard Events
  handleKeyboardEvent(event: Event): void,
  keystrokeForKeyboardEvent(event: Event): string,
  getPartialMatchTimeout(): number,

  static buildKeydownEvent(
    key: string,
    options: {
      target: HTMLElement,
      alt?: boolean,
      cmd?: boolean,
      ctrl?: boolean,
      shift?: boolean,
    },
  ): Event,
}

declare class atom$MenuManager {
  add(items: Array<Object>): IDisposable,
  update(): void,

  // Private API
  template: Array<Object>,
}

declare class atom$Project {
  // Event Subscription
  onDidChangePaths(callback: (projectPaths: Array<string>) => mixed): IDisposable,
  onDidAddBuffer(callback: (buffer: atom$TextBuffer) => mixed): IDisposable,
  observeBuffers(callback: (buffer: atom$TextBuffer) => mixed): IDisposable,

  // Accessing the git repository
  getRepositories(): Array<?atom$Repository>,
  repositoryForDirectory(directory: atom$Directory): Promise<?atom$Repository>,

  // Managing Paths
  getPaths(): Array<string>,
  addPath(projectPath: string): void,
  setPaths(paths: Array<string>): void,
  removePath(projectPath: string): void,
  getDirectories(): Array<atom$Directory>,
  relativizePath(relativizePath?: string): Array<string>, // [projectPath: ?string, relativePath: string]
  relativize(filePath: string): string,
  contains(path: string): boolean,

  // Private API
  findBufferForPath(path: string): ?atom$TextBuffer,
  addBuffer(buffer: atom$TextBuffer): void,
  removeBuffer(buffer: atom$TextBuffer): void,
  getBuffers(): Array<atom$TextBuffer>,
}

type TextBufferScanIterator = (arg: {
  match: Array<string>,
  matchText: string,
  range: atom$Range,
  stop(): void,
  replace(replacement: string): void,
}) => void;

// This happens to be a number but it would be better if the type could be entirely opaque. All you
// need to know is that if something needs a checkpoint you should only pass it values received from
// TextBuffer::createCheckpoint
type atom$TextBufferCheckpoint = number;

// TextBuffer did-change/will-change
type atom$TextEditEvent = {
  oldRange: atom$Range,
  newRange: atom$Range,
  oldText: string,
  newText: string,
};

type atom$AggregatedTextEditEvent = {
  changes: Array<atom$TextEditEvent>,
};

declare class atom$TextBuffer {
  constructor(text?: string): atom$TextBuffer,
  constructor(params?: {
    filePath?: string,
    text?: string,
  }): atom$TextBuffer,

  file: ?atom$File,

  // Mixin
  static deserialize: (state: Object, params: Object) => mixed,

  // Events
  onWillChange(callback: (event: atom$TextEditEvent) => mixed): IDisposable,
  onDidChange(callback: (event: atom$TextEditEvent) => mixed): IDisposable,
  onDidChangeText(callback: (event: atom$AggregatedTextEditEvent) => mixed): IDisposable,
  onDidStopChanging(callback: () => mixed): IDisposable,
  onDidConflict(callback: () => mixed): IDisposable,
  onDidChangeModified(callback: () => mixed): IDisposable,
  onDidUpdateMarkers(callback: () => mixed): IDisposable,
  onDidCreateMarker(callback: () => mixed): IDisposable,
  onDidChangePath(callback: () => mixed): IDisposable,
  onDidChangeEncoding(callback: () => mixed): IDisposable,
  onWillSave(callback: () => mixed): IDisposable,
  onDidSave(callback: (event: {path: string}) => mixed): IDisposable,
  onDidDelete(callback: () => mixed): IDisposable,
  onWillReload(callback: () => mixed): IDisposable,
  onDidReload(callback: () => mixed): IDisposable,
  onDidDestroy(callback: () => mixed): IDisposable,
  onWillThrowWatchError(callback: () => mixed): IDisposable,

  // File Details
  // DO NOT USE (T21363106): Doesn't work with remote text buffers!
  // setPath(filePath: string): void,
  getPath(): ?string,
  setEncoding(encoding: string): void,
  getEncoding(): string,
  getUri(): string,
  getId(): string,

  // Reading Text
  isEmpty(): boolean,
  getText(): string,
  getTextInRange(range: atom$RangeLike): string,
  getLineCount(): number,
  getLines(): Array<string>,
  getLastLine(): string,
  lineForRow(row: number): string,
  lineEndingForRow(row: number): string,
  lineLengthForRow(row: number): number,
  isRowBlank(row: number): boolean,
  previousNonBlankRow(startRow: number): ?number,
  nextNonBlankRow(startRow: number): ?number,

  // Mutating Text
  setText: (text: string) => atom$Range,
  setTextInRange(range: atom$RangeLike, text: string, options?: Object): atom$Range,
  setTextViaDiff(text: string): void,
  insert(
    position: atom$Point,
    text: string,
    options?: {
      normalizeLineEndings?: boolean,
      undo?: string,
    },
  ): atom$Range,
  append(text: string, options: ?{
    normalizeLineEndings?: boolean,
    undo?: string,
  }): atom$Range,
  delete(range: atom$Range): atom$Range,
  deleteRows(startRow: number, endRow: number): atom$Range,

  // History
  undo(): void,
  redo(): void,
  transact(fn: () => mixed, _: void): void,
  transact(groupingInterval: number, fn: () => mixed): void,
  clearUndoStack(): void,
  createCheckpoint(): atom$TextBufferCheckpoint,
  revertToCheckpoint(checkpoint: atom$TextBufferCheckpoint): boolean,
  groupChangesSinceCheckpoint(checkpoint: atom$TextBufferCheckpoint): boolean,
  // TODO describe the return type more precisely.
  getChangesSinceCheckpoint(checkpoint: atom$TextBufferCheckpoint): Array<mixed>,

  // Search And Replace
  scan(regex: RegExp, iterator: TextBufferScanIterator): void,
  scanInRange(regex: RegExp, range: atom$Range, iterator: TextBufferScanIterator): void,
  backwardsScanInRange(regex: RegExp, range: atom$Range, iterator: TextBufferScanIterator): void,

  // Buffer Range Details
  getLastRow(): number,
  getRange(): atom$Range,
  rangeForRow(row: number, includeNewLine?: boolean): atom$Range,

  // Position/Index mapping
  characterIndexForPosition(position: atom$PointLike): number,
  positionForCharacterIndex(index: number): atom$Point,

  // Buffer Operations
  reload(): void,
  load(): Promise<void>,
  save(): void,

  isInConflict(): boolean,
  isModified(): boolean,

  // Private APIs
  cachedDiskContents: ?string,
  emitter: atom$Emitter,
  refcount: number,
  loaded: boolean,
  wasModifiedBeforeRemove: boolean,
  finishLoading(): atom$TextBuffer,
  updateCachedDiskContents(flushCache?: boolean, callback?: () => mixed): Promise<void>,
  emitModifiedStatusChanged(changed: boolean): void,
  destroy(): void,
  isDestroyed(): boolean,
  applyChange: () => void,
  shouldDestroyOnFileDelete?: () => boolean,
}

declare class atom$Notification {
  // Event Subscription
  onDidDismiss(callback: () => mixed): IDisposable,
  onDidDisplay(callback: () => mixed): IDisposable,

  // Methods
  getType(): string,
  getMessage(): string,
  getOptions(): Object,
  dismiss(): void,
}

type atom$NotificationButton = {
  text: string,
  className?: string,
  onDidClick?: () => mixed,
};

type atom$NotificationOptions = {
  detail?: string,
  dismissable?: boolean,
  description?: string,
  icon?: string,
  buttons?: Array<atom$NotificationButton>,
};

declare class atom$NotificationManager {
  // Events
  onDidAddNotification(callback: (notification: atom$Notification) => void): IDisposable,

  // Adding Notifications
  add(type: string, message: string, options?: atom$NotificationOptions): atom$Notification,
  addSuccess(message: string, options?: atom$NotificationOptions): atom$Notification,
  addInfo(message: string, options?: atom$NotificationOptions): atom$Notification,
  addWarning(message: string, options?: atom$NotificationOptions): atom$Notification,
  addError(message: string, options?: atom$NotificationOptions): atom$Notification,
  addFatalError(message: string, options?: atom$NotificationOptions): atom$Notification,

  // Getting Notifications
  getNotifications(): Array<atom$Notification>,
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
  originalError: Object,
  message: string,
  url: string,
  line: number,
  column: number,
};

// The properties of this type match the properties of the `atom` global.
// This list is not complete.
type AtomGlobal = {
  // Properties
  appVersion: string,
  atomScriptMode: ?boolean, // Added by nuclide-atom-script.
  clipboard: atom$Clipboard,
  commands: atom$CommandRegistry,
  config: atom$Config,
  contextMenu: atom$ContextMenuManager,
  applicationDelegate: atom$applicationDelegate,
  deserializers: atom$DeserializerManager,
  grammars: atom$GrammarRegistry,
  history: atom$HistoryManager,
  keymaps: atom$KeymapManager,
  menu: atom$MenuManager,
  notifications: atom$NotificationManager,
  packages: atom$PackageManager,
  styles: atom$StyleManager,
  themes: atom$ThemeManager,
  textEditors: atom$TextEditorRegistry,
  tooltips: atom$TooltipManager,
  views: atom$ViewRegistry,
  workspace: atom$Workspace,
  project: atom$Project,
  devMode: boolean,

  // Event Subscription
  onWillThrowError(callback: (event: atom$UnhandledErrorEvent) => mixed): IDisposable,
  onDidThrowError(callback: (event: atom$UnhandledErrorEvent) => mixed): IDisposable,

  // Atom Details
  inDevMode(): boolean,
  inSafeMode(): boolean,
  inSpecMode(): boolean,
  getVersion(): string,
  isReleasedVersion(): boolean,
  getWindowLoadTime(): number,

  // This is an undocumented way to reach the Electron BrowserWindow.
  // Use `electron.remote.getCurrentWindow` instead.
  getCurrentWindow: void,

  // Messaging the User
  confirm(options: {
    buttons?: Array<string> | {[buttonName: string]: () => mixed},
    detailedMessage?: string,
    message: string,
  }): ?number,

  open(params: {
    pathsToOpen?: Array<string>,
    newWindow?: boolean,
    devMode?: boolean,
    safeMode?: boolean,
  }): void,
  reload(): void,

  // Undocumented Methods
  getConfigDirPath(): string,
  showSaveDialogSync(options: Object): string,
  loadState(): Promise<?Object>,
  getLoadSettings(): Object,
};

declare var atom: AtomGlobal;

type RepositoryDidChangeStatusCallback = (event: {path: string, pathStatus: number}) => mixed;
type RepositoryLineDiff = {
  oldStart: number,
  newStart: number,
  oldLines: number,
  newLines: number,
};

// Taken from the interface of [`GitRepository`][1], which is also implemented by
// `HgRepositoryClient`.
//
// [1]: https://github.com/atom/atom/blob/v1.7.3/src/git-repository.coffee
declare class atom$Repository {
  constructor(path: string, options?: {refreshOnWindowFocus?: boolean}): void,

  // Event Subscription
  onDidChangeStatus: (callback: RepositoryDidChangeStatusCallback) => IDisposable,
  onDidChangeStatuses: (callback: () => mixed) => IDisposable,

  // Repository Details
  getType: () => string,
  getPath: () => string,
  getWorkingDirectory: () => string,
  isProjectAtRoot: () => boolean,
  relativize: (aPath: string) => string,
  getOriginURL: (aPath: ?string) => ?string,

  // Reading Status
  isPathModified: (aPath: string) => boolean,
  isPathNew: (aPath: string) => boolean,
  isPathIgnored: (aPath: string) => boolean,
  getDirectoryStatus: (aPath: string) => number,
  getPathStatus: (aPath: string) => number,
  getCachedPathStatus: (aPath: string) => ?number,
  isStatusModified: (status: number) => boolean,
  isStatusNew: (status: number) => boolean,
  refreshStatus: () => Promise<void>,

  // Retrieving Diffs
  getDiffStats: (filePath: string) => {added: number, deleted: number},
  getLineDiffs: (aPath: string, text: string) => Array<RepositoryLineDiff>,

  // Checking Out
  checkoutHead: (aPath: string) => boolean,
  checkoutReference: (reference: string, create: boolean) => Promise<void>,

  // Event Subscription
  onDidDestroy(callback: () => mixed): IDisposable,
  isDestroyed(): boolean,
}

declare class atom$GitRepositoryInternal {
  // Reading Status
  isStatusModified: (status: number) => boolean,
  isStatusNew: (status: number) => boolean,
  isStatusIgnored: (status: number) => boolean,
  isStatusStaged: (status: number) => boolean,
  isStatusDeleted: (status: number) => boolean,
}

// One of text or snippet is required.
// TODO(hansonw): use a union + intersection type
type atom$AutocompleteSuggestion = {
  text?: string,
  snippet?: string,
  displayText?: string,
  replacementPrefix?: string,
  type?: ?string,
  leftLabel?: ?string,
  leftLabelHTML?: ?string,
  rightLabel?: ?string,
  rightLabelHTML?: ?string,
  className?: ?string,
  iconHTML?: ?string,
  description?: ?string,
  descriptionMoreURL?: ?string,
};

type atom$AutocompleteRequest = {
  editor: TextEditor,
  bufferPosition: atom$Point,
  scopeDescriptor: string,
  prefix: string,
  activatedManually?: boolean,
};

type atom$AutocompleteProvider = {
  +selector: string,
  +getSuggestions: (
    request: atom$AutocompleteRequest,
  ) => Promise<?Array<atom$AutocompleteSuggestion>>,
  +onDidInsertSuggestion?: (
    insertedSuggestion: atom$SuggestionInsertedRequest,
  ) => void,
  +disableForSelector?: string,
  +inclusionPriority?: number,
  +excludeLowerPriority?: boolean,
};

type atom$SuggestionInsertedRequest = {
  editor: atom$TextEditor,
  triggerPosition: atom$Point,
  suggestion: atom$AutocompleteSuggestion,
};

// Undocumented API.
declare class atom$Token {
  value: string,
  matchesScopeSelector(selector: string): boolean,
}

declare class atom$Selection {
  clear(): void,
  getText(): string,
  insertText(
    text: string,
    options?: {
      select?: boolean,
      autoIndent?: boolean,
      autoIndentNewLine?: boolean,
      autoDecreaseIdent?: boolean,
      normalizeLineEndings?: boolean,
      undo?: boolean,
    },
  ): string,
}

declare class atom$PanelContainer {
  dock: atom$Dock,
  element: HTMLElement,
  emitter: atom$Emitter,
  location: atom$PaneLocation,
  panels: Array<atom$Panel>,
  subscriptions: atom$CompositeDisposable,
  viewRegistry: atom$ViewRegistry,

  getPanels(): Array<atom$Panel>,
};
