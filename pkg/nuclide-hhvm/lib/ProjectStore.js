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

/* global localStorage */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {DebugMode} from './types';

import {Emitter} from 'atom';
import {getLogger} from 'log4js';
import debounce from 'nuclide-commons/debounce';
import {BehaviorSubject} from 'rxjs';

// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {HACK_GRAMMARS} from '../../nuclide-hack-common';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import {isFileInHackProject} from '../../nuclide-hack/lib/HackLanguage';
import {trackTiming} from 'nuclide-analytics';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import invariant from 'assert';
import {Observable} from 'rxjs';

type AttachToServerSettings = {|
  type: 'attach',
  openInBrowserUri: string,
|};

type LaunchScriptSettings = {|
  type: 'launch',
  debugMode: DebugMode,
  scriptCommand: string,
  scriptArguments: string,
  lastUsageKey: number,
|};

type ScriptSettings = AttachToServerSettings | LaunchScriptSettings;

const LOCAL_STORAGE_KEY = 'hhvm_toolbar_settings';
const STORAGE_VERSION = 1;
const MRU_MAX_LENGTH = 20;
let mruIndex = 0;

export default class ProjectStore {
  _disposables: UniversalDisposable;
  _emitter: Emitter;

  _currentFilePath: ?NuclideUri;
  _projectRoot: BehaviorSubject<?NuclideUri>;
  _currentProjectRoot: ?NuclideUri;
  _isProjectRootHackRoot: boolean;
  _debugMode: DebugMode;
  _stickySettings: ?ScriptSettings;
  _useTerminal: boolean;

  _launchSettingsByPath: Map<NuclideUri, Map<DebugMode, LaunchScriptSettings>>;
  _attachSettingsByHost: Map<string, AttachToServerSettings>;
  _dirty: boolean;

  constructor() {
    this._emitter = new Emitter();
    this._currentFilePath = null;
    this._projectRoot = new BehaviorSubject();
    this._currentProjectRoot = null;
    this._isProjectRootHackRoot = false;
    this._debugMode = 'webserver';
    this._useTerminal = false;
    this._stickySettings = null;
    this._launchSettingsByPath = new Map();
    this._attachSettingsByHost = new Map();
    this._dirty = false;
    // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
    this._saveSettings = debounce(this._saveSettings, 1000);

    const onDidChange = this._onDidChangeActivePaneItem.bind(this);
    this._disposables = new UniversalDisposable(
      this._projectRoot
        .do(() => {
          this._isProjectRootHackRoot = false;
          this._emitter.emit('change');
        })
        .switchMap(root =>
          Observable.fromPromise(this._isFileHHVMProject(root)).switchMap(
            isHHVM => Observable.of({root, isHHVM}),
          ),
        )
        .subscribe(data => {
          const {root, isHHVM} = data;
          this._isProjectRootHackRoot = isHHVM;
          this._currentProjectRoot = root;
          this._emitter.emit('change');
        }),
      atom.workspace.onDidStopChangingActivePaneItem(onDidChange),
    );

    this._restoreSettings();
    onDidChange();
  }

  saveSettings(): void {
    this._saveSettings();
  }

  _saveSettings = () => {
    if (!this._dirty) {
      return;
    }

    const launchSettings = [
      ...Array.from(this._launchSettingsByPath.entries())
        .sort((a, b) => {
          // Save settings for the MRU_MAX_LENGTH most recently used launch
          // configurations. Cap this so we don't store values for every
          // script ever launched, forever.
          let lastUsageA = 0;
          for (const entry of a[1]) {
            if (entry[1].lastUsageKey > lastUsageA) {
              lastUsageA = entry[1].lastUsageKey;
            }
          }

          let lastUsageB = 0;
          for (const entry of b[1]) {
            if (entry[1].lastUsageKey > lastUsageB) {
              lastUsageB = entry[1].lastUsageKey;
            }
          }

          return lastUsageB - lastUsageA;
        })
        .slice(0, MRU_MAX_LENGTH),
    ];
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        launchSettings,
        lastDebugMode: this.getDebugMode(),
        storageVersion: STORAGE_VERSION,
      }),
    );
    this._dirty = false;
  };

  _restoreSettings(): void {
    try {
      const serialized = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (serialized != null) {
        const obj = JSON.parse(serialized);
        if (
          obj.storageVersion == null ||
          Number.isNaN(parseInt(obj.storageVersion, 10))
        ) {
          return;
        }

        if (obj.lastDebugMode != null) {
          this.setDebugMode(obj.lastDebugMode);
        }

        if (obj.launchSettings != null) {
          this._launchSettingsByPath = new Map();
          mruIndex = 0;
          for (const data of obj.launchSettings) {
            const key = data.shift();
            const values = (data: Array<[DebugMode, LaunchScriptSettings]>);
            // Serialized items are already in MRU order. Update the last
            // usage keys so they are numbered relative to mruIndex which
            // can reset to 0 on each nuclide launch and still preserve the
            // MRU order.
            for (const value of values) {
              value[1].lastUsageKey = ++mruIndex;
            }
            this._launchSettingsByPath.set(key, new Map(values));
          }
        }
      }
    } catch (e) {
      getLogger('hhvm-toolbar').warn(
        'Failed to restore HHVM settings: ' + e.toString(),
      );
    }
    this._emitter.emit('change');
  }

  _onChanged(): void {
    this._dirty = true;
    this._emitter.emit('change');
  }

  _onDidChangeActivePaneItem(): void {
    const activeTextEditor = atom.workspace.getActiveTextEditor();
    const newFocusedPath =
      activeTextEditor != null ? activeTextEditor.getPath() : null;

    // If the newly focused editor is null, or is a document that is not
    // a Hack/PHP file, keep our HHVM settings focused on whatever they
    // already are (the previous Hack/PHP file).
    if (newFocusedPath != null && this._isPathHackFile(newFocusedPath)) {
      this._currentFilePath = newFocusedPath;
      this._emitter.emit('change');
    }
  }

  _isFileHHVMProject(fileUri: ?string): Promise<boolean> {
    return trackTiming('toolbar.isFileHHVMProject', async () => {
      return (
        fileUri != null &&
        (nuclideUri.isRemote(fileUri) || process.platform !== 'win32') &&
        isFileInHackProject(fileUri)
      );
    });
  }

  _getOrCreateCurrentAttachSettings(): AttachToServerSettings {
    const host =
      this._currentProjectRoot == null ||
      nuclideUri.isLocal(this._currentProjectRoot)
        ? 'localhost'
        : nuclideUri.getHostname(this._currentProjectRoot);

    const settings = this._attachSettingsByHost.get(host);
    if (settings != null) {
      return settings;
    }

    // Insert default settings the first time we see a new host set as
    // the current project root.
    const defaultSettings = {
      type: 'attach',
      openInBrowserUri: host,
    };
    this._attachSettingsByHost.set(host, defaultSettings);
    return defaultSettings;
  }

  _getCurrentLaunchSettings(createIfMissing: boolean): LaunchScriptSettings {
    // Mode is either "Launch Script" or a custom wrapper.
    const debugMode = this.getDebugMode();
    const key = this._currentFilePath || '';
    let settingsForPath = this._launchSettingsByPath.get(key);
    if (settingsForPath == null) {
      this._launchSettingsByPath.set(key, new Map());
      settingsForPath = this._launchSettingsByPath.get(key);
    }
    invariant(settingsForPath != null);

    const settingsForPathAndMode = settingsForPath.get(debugMode);
    if (settingsForPathAndMode != null) {
      return settingsForPathAndMode;
    }

    // If this is the first time we've seen this file as the active file
    // PLUS this debug mode, insert default settings for it, which start
    // off with blank arguments.
    const path = this._currentFilePath || '';
    const defaultSettings = {
      type: 'launch',
      debugMode,
      scriptCommand: nuclideUri.getPath(path),
      scriptArguments: '',
      lastUsageKey: ++mruIndex,
    };

    // If the debug mode is a custom wrapper, determine what the script
    // command is supposed to be.
    if (debugMode !== 'script') {
      try {
        // $FlowFB
        const {suggestDebugTargetName} = require('./fb-hhvm');
        defaultSettings.scriptCommand =
          suggestDebugTargetName(debugMode, path) || '';
      } catch (e) {}
    }

    if (createIfMissing) {
      settingsForPath.set(debugMode, defaultSettings);
    }
    return defaultSettings;
  }

  // Returns the current script settings. If writeable is true, and there
  // aren't any settings yet for the current taget + debug mode, they'll
  // be created and persisted to the store. Callers should not pass writeable
  // unless they are modifying the settings (to avoid storing empty settings
  // for every file + mode the user touches for no reason).
  _getCurrentSettings(writeable: boolean): ScriptSettings {
    if (this._stickySettings != null) {
      return this._stickySettings;
    }

    const debugMode = this.getDebugMode();
    return debugMode === 'webserver'
      ? this._getOrCreateCurrentAttachSettings()
      : this._getCurrentLaunchSettings(writeable);
  }

  onChange(callback: () => void): IDisposable {
    return this._emitter.on('change', callback);
  }

  setProjectRoot(root: ?NuclideUri): void {
    this._projectRoot.next(root);
  }

  getProjectRoot(): ?NuclideUri {
    return this._projectRoot.getValue();
  }

  isHHVMProject(): ?boolean {
    return this._isProjectRootHackRoot;
  }

  getDebugMode(): DebugMode {
    return this._debugMode;
  }

  setDebugMode(debugMode: DebugMode): void {
    this._debugMode = debugMode;
    this._onChanged();
  }

  setUseTerminal(useTerminal: boolean): void {
    this._useTerminal = useTerminal;
    this._emitter.emit('change');
  }

  getSticky(): boolean {
    return this._stickySettings != null;
  }

  setSticky(sticky: boolean): void {
    if (sticky) {
      invariant(this.isCurrentSettingDebuggable());
      this._stickySettings = this._getCurrentSettings(true);
    } else {
      this._stickySettings = null;
    }
    this._onChanged();
  }

  updateLastUsed(): void {
    const settings = this._getCurrentSettings(true);
    if (settings.type === 'launch') {
      settings.lastUsageKey = ++mruIndex;
    }
  }

  getScriptArguments(): string {
    const settings = this._getCurrentSettings(false);
    return settings.type === 'launch'
      ? settings.scriptArguments
      : // Attach to server never has any script arguments.
        '';
  }

  setScriptArguments(args: string): void {
    const settings = this._getCurrentSettings(true);
    invariant(settings.type === 'launch');
    settings.scriptArguments = args;
    this._onChanged();
  }

  getUseTerminal(): boolean {
    return this._useTerminal;
  }

  getLaunchTarget(): string {
    const settings = this._getCurrentSettings(false);
    return settings.type === 'attach'
      ? settings.openInBrowserUri
      : settings.scriptCommand;
  }

  setDebugTarget(target: string): void {
    const settings = this._getCurrentSettings(true);
    if (settings.type === 'attach') {
      settings.openInBrowserUri = target;
    } else {
      settings.scriptCommand = target;
    }
    this._onChanged();
  }

  getDebugTarget(): string {
    const settings = this._getCurrentSettings(false);
    if (settings.type === 'attach') {
      return settings.openInBrowserUri;
    } else {
      return settings.scriptCommand;
    }
  }

  isCurrentSettingDebuggable(): boolean {
    const settings = this._getCurrentSettings(false);
    if (settings.type === 'attach') {
      return this._isProjectRootHackRoot;
    }

    // Otherwise the current file is a script. If we have sticky settings
    // from a previously focused Hack/PHP editor tab, then the target is
    // debuggable using those settings.
    if (this._stickySettings != null) {
      return true;
    }

    if (
      settings.scriptCommand == null ||
      settings.scriptCommand.trim() === ''
    ) {
      return false;
    }

    if (this.getDebugMode() === 'script') {
      const path =
        this._currentProjectRoot != null &&
        nuclideUri.isRemote(this._currentProjectRoot)
          ? nuclideUri.createRemoteUri(
              nuclideUri.getHostname(this._currentProjectRoot),
              settings.scriptCommand,
            )
          : settings.scriptCommand;
      return this._isPathHackFile(path);
    } else {
      // This is a custom mode, treat it as valid if the target box is not empty.
      return true;
    }
  }

  _isPathHackFile(path: string): boolean {
    // Otherwise, the target is debuggable if the current editor tab is Hack/PHP.
    if (path.endsWith('.php') || path.endsWith('.hh')) {
      return true;
    }

    const currentEditor = atom.workspace.getActiveTextEditor();
    return (
      currentEditor != null &&
      HACK_GRAMMARS.indexOf(currentEditor.getGrammar().scopeName) > 0
    );
  }

  dispose() {
    this._disposables.dispose();
  }
}
