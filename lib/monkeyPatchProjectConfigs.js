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

// TODO: Remove this file once `atom.project.replace()` and `atom.project.getSpecification()` have
// been upstreamed. https://github.com/atom/atom/pull/16845.

// $eslint-disable-next-line
import nuclideUri from 'nuclide-commons/nuclideUri';
import {isPlainObject} from 'lodash';

let currentProjectSpec;

export default function monkeyPatchProjectConfigs() {
  if (atom.project.replace == null) {
    updateConfigGet();
    addConfigResetProjectSettings();
    addReplace();
    addGettersAndEvents();
  }

  // `atom.project.replace()` may be present but only look for `config` in the top level. We want to
  // support it nested in an "atom" key too (for portability).
  // TODO: Remove this once it's upstreamed.
  const replaceProject = atom.project.replace;
  if (replaceProject != null) {
    atom.project.replace = projectSpecification => {
      let formatted = {...projectSpecification};
      if ((formatted: any).atom != null) {
        formatted = {...formatted, ...(formatted: any).atom};
        delete formatted.atom;
      }
      currentProjectSpec = formatted;
      return replaceProject.call(atom.project, formatted);
    };
  }

  // TODO: Upstream this and remove it here.
  // $FlowIgnore: Add this to our typedefs once upstreamed.
  const getProjectSpecification = atom.project.getSpecification;
  if (getProjectSpecification == null) {
    // $FlowIgnore: Add this to our typedefs once upstreamed.
    atom.project.getSpecification = () => currentProjectSpec;
  }
}

const addReplace = () => {
  atom.project.replace = projectSpecification => {
    if (projectSpecification == null) {
      // $FlowIgnore
      atom.config.clearProjectSettings();
      atom.project.setPaths([]);
    } else {
      if (projectSpecification.originPath == null) {
        return;
      }

      // If no path is specified, set to directory of originPath.
      if (!Array.isArray(projectSpecification.paths)) {
        projectSpecification.paths = [
          nuclideUri.dirname(projectSpecification.originPath),
        ];
      }
      // $FlowIgnore
      atom.config.resetProjectSettings(
        projectSpecification.config,
        projectSpecification.originPath,
      );

      // $FlowIgnore
      atom.project.setPaths(projectSpecification.paths);
    }
    // $FlowIgnore
    atom.project.emitter.emit('did-replace', projectSpecification);
  };

  // $FlowIgnore
  atom.project.onDidReplace = callback => {
    // $FlowIgnore
    return atom.project.emitter.on('did-replace', callback);
  };
};

const addGettersAndEvents = () => {
  // $FlowIgnore
  atom.project.onDidReplace = callback => {
    // $FlowIgnore
    return atom.project.emitter.on('did-replace', callback);
  };
};

const updateConfigGet = () => {
  // $FlowIgnore
  atom.config.projectFile = null;
  // $FlowIgnore
  atom.config.projectSettings = {};

  // $FlowIgnore
  atom.config.getRawValue = (keyPath, options = {}) => {
    let value;
    if (
      !options.excludeSources ||
      // $FlowIgnore
      !options.excludeSources.includes(atom.config.mainSource)
    ) {
      // $FlowIgnore
      value = getValueAtKeyPath(atom.config.settings, keyPath);
      // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
      if (atom.config.projectFile != null) {
        const projectValue = getValueAtKeyPath(
          // $FlowIgnore
          atom.config.projectSettings,
          keyPath,
        );
        value = projectValue === undefined ? value : projectValue;
      }
    }

    let defaultValue;
    if (!options.sources || options.sources.length === 0) {
      defaultValue = getValueAtKeyPath(atom.config.defaultSettings, keyPath);
    }

    if (value != null) {
      // $FlowIgnore
      value = atom.config.deepClone(value);
      if (isPlainObject(value) && isPlainObject(defaultValue)) {
        // $FlowIgnore
        atom.config.deepDefaults(value, defaultValue);
      }
      return value;
    } else {
      // $FlowIgnore
      return atom.config.deepClone(defaultValue);
    }
  };
  // $FlowIgnore
  atom.config.setRawValue = (keyPath, value, options = {}) => {
    const source = options.source ? options.source : undefined;
    const settingsToChange =
      // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
      source === atom.config.projectFile ? 'projectSettings' : 'settings';

    const defaultValue = getValueAtKeyPath(
      atom.config.defaultSettings,
      keyPath,
    );

    if (isEqual(defaultValue, value)) {
      if (keyPath != null) {
        // $FlowIgnore
        deleteValueAtKeyPath(atom.config[settingsToChange], keyPath);
      } else {
        // $FlowIgnore
        atom.config[settingsToChange] = null;
      }
    } else {
      if (keyPath != null) {
        // $FlowIgnore
        setValueAtKeyPath(atom.config[settingsToChange], keyPath, value);
      } else {
        // $FlowIgnore
        atom.config[settingsToChange] = value;
      }
    }
    // $FlowIgnore
    return atom.config.emitChangeEvent();
  };

  // $FlowIgnore
  atom.config.get = (...args) => {
    let keyPath;
    let options;
    let scope;
    if (args.length > 1) {
      if (typeof args[0] === 'string' || args[0] == null) {
        [keyPath, options] = args;
        ({scope} = options);
      }
    } else {
      [keyPath] = args;
    }

    if (scope != null) {
      // $FlowIgnore
      const value = atom.config.getRawScopedValue(scope, keyPath, options);
      // $FlowIgnore
      return value != null ? value : atom.config.getRawValue(keyPath, options);
    } else {
      // $FlowIgnore
      return atom.config.getRawValue(keyPath, options);
    }
  };

  // $FlowIgnore
  atom.config.set = (...args) => {
    // eslint-disable-next-line
    let [keyPath, value, options = {}] = args;
    // $FlowIgnore
    if (!atom.config.settingsLoaded) {
      // $FlowIgnore
      atom.config.pendingOperations.push(() =>
        atom.config.set(keyPath, value, options),
      );
    }

    const scopeSelector = options.scopeSelector;
    let source = options.source;

    const shouldSave = options.save != null ? options.save : true;

    // $FlowIgnore
    if (source && !scopeSelector && source !== atom.config.projectFile) {
      throw new Error(
        "::set with a 'source' and no 'sourceSelector' is not yet implemented!",
      );
    }
    if (source == null) {
      // $FlowIgnore
      source = atom.config.mainSource;
    }

    if (value !== undefined) {
      try {
        // $FlowIgnore
        value = atom.config.makeValueConformToSchema(keyPath, value);
      } catch (e) {
        return false;
      }
    }

    if (scopeSelector != null) {
      // $FlowIgnore
      atom.config.setRawScopedValue(keyPath, value, source, scopeSelector);
    } else {
      // $FlowIgnore
      atom.config.setRawValue(keyPath, value, {source});
    }

    if (
      // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
      source === atom.config.mainSource &&
      shouldSave &&
      // $FlowIgnore
      atom.config.settingsLoaded
    ) {
      // $FlowIgnore
      atom.config.requestSave();
    }
    return true;
  };

  // $FlowIgnore
  atom.config.getRawScopedValue = (scopeDescriptor, keyPath, options) => {
    const newScopeDescriptor = ScopeDescriptor.fromObject(scopeDescriptor);

    // $FlowIgnore
    const result = atom.config.scopedSettingsStore.getPropertyValue(
      newScopeDescriptor.getScopeChain(),
      keyPath,
      options,
    );
    // $FlowIgnore
    const legacyScopeDescriptor = atom.config.getLegacyScopeDescriptorForNewScopeDescriptor(
      newScopeDescriptor,
    );
    if (result != null) {
      return result;
    } else if (legacyScopeDescriptor) {
      // $FlowIgnore
      return atom.config.scopedSettingsStore.getPropertyValue(
        legacyScopeDescriptor.getScopeChain(),
        keyPath,
        options,
      );
    }
  };

  // $FlowIgnore
  atom.config.getAll = (keyPath, options = {}) => {
    let result;
    let scope;
    if (options != null) {
      ({scope} = options);
    }

    if (scope != null) {
      const scopeDescriptor = ScopeDescriptor.fromObject(scope);
      // $FlowIgnore
      result = atom.config.scopedSettingsStore.getAll(
        scopeDescriptor.getScopeChain(),
        keyPath,
        options,
      );
      // $FlowIgnore
      const legacyScopeDescriptor = atom.config.getLegacyScopeDescriptorForNewScopeDescriptor(
        scopeDescriptor,
      );
      if (legacyScopeDescriptor) {
        result.push(
          ...Array.from(
            // $FlowIgnore
            atom.config.scopedSettingsStore.getAll(
              legacyScopeDescriptor.getScopeChain(),
              keyPath,
              options,
            ) || [],
          ),
        );
      }
    } else {
      result = [];
    }

    const globalValue = atom.config.getRawValue(keyPath, options);
    // $FlowIgnore
    if (globalValue) {
      result.push({scopeSelector: '*', value: globalValue});
    }

    return result;
  };

  // $FlowIgnore
  atom.config.legacyScopeAliases = new Map();

  // $FlowIgnore
  atom.config.setLegacyScopeAliasForNewScope = (
    languageId,
    legacyScopeName,
  ) => {
    // $FlowIgnore
    atom.config.legacyScopeAliases.set(languageId, legacyScopeName);
  };

  // $FlowIgnore
  atom.config.removeLegacyScopeAliasForNewScope = languageId => {
    // $FlowIgnore
    atom.config.legacyScopeAliases.delete(languageId);
  };
  // $FlowIgnore
  atom.config.getLegacyScopeDescriptorForNewScopeDescriptor = scopeDescriptor => {
    const newScopeDescriptor = ScopeDescriptor.fromObject(scopeDescriptor);
    // $FlowIgnore
    const legacyAlias = atom.config.legacyScopeAliases.get(
      // $FlowIgnore
      newScopeDescriptor.scopes[0],
    );
    if (legacyAlias) {
      // $FlowIgnore
      const scopes = newScopeDescriptor.scopes.slice();
      scopes[0] = legacyAlias;
      return new ScopeDescriptor({scopes});
    }
  };
};

const addConfigResetProjectSettings = () => {
  // $FlowIgnore
  atom.config._clearUnscopedSettingsForSource = source => {
    // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
    if (source === atom.config.projectFile) {
      /* $FlowFixMe(>=0.86.0) This
       * comment suppresses an error found when Flow v0.86 was
       * deployed. To see the error, delete this comment and
       * run Flow. */
      atom.config.projectSettings = {};
    } else {
      atom.config.settings = {};
    }
  };

  // $FlowIgnore
  atom.config.resetScopedSettings = (newScopedSettings, options = {}) => {
    const source =
      // $FlowIgnore
      options.source == null ? atom.config.mainSource : options.source;

    // $FlowIgnore
    const priority = atom.config.priorityForSource(source);

    // $FlowIgnore
    atom.config.scopedSettingsStore.removePropertiesForSource(source);

    for (const scopeSelector in newScopedSettings) {
      let settings = newScopedSettings[scopeSelector];
      // $FlowIgnore
      settings = atom.config.makeValueConformToSchema(null, settings, {
        suppressException: true,
      });
      const validatedSettings = {};
      validatedSettings[scopeSelector] = withoutEmptyObjects(settings);
      if (validatedSettings[scopeSelector] != null) {
        // $FlowIgnore
        atom.config.scopedSettingsStore.addProperties(
          source,
          validatedSettings,
          {
            priority,
          },
        );
      }
    }
    // $FlowIgnore
    return atom.config.emitChangeEvent();
  };

  // $FlowIgnore
  atom.config.resetUserScopedSettings = atom.config.resetScopedSettings;

  // $FlowIgnore
  atom.config._resetSettings = (ns, options = {}) => {
    let newSettings = ns;
    const source = options.source;
    // eslint-disable-next-line
    newSettings = Object.assign({}, newSettings);
    if (newSettings.global != null) {
      newSettings['*'] = newSettings.global;
      delete newSettings.global;
    }

    if (newSettings['*'] != null) {
      const scopedSettings = newSettings;
      newSettings = newSettings['*'];
      delete scopedSettings['*'];
      // $FlowIgnore
      atom.config.resetScopedSettings(scopedSettings, {source});
    }

    // $FlowIgnore
    return atom.config.transact(() => {
      // $FlowIgnore
      atom.config._clearUnscopedSettingsForSource(source);
      // $FlowIgnore
      atom.config.settingsLoaded = true;
      for (const key in newSettings) {
        const value = newSettings[key];
        atom.config.set(key, value, {save: false, source});
      }
      // $FlowIgnore
      if (atom.config.pendingOperations.length) {
        for (const op of atom.config.pendingOperations) {
          op();
        }
        // $FlowIgnore
        atom.config.pendingOperations = [];
      }
    });
  };
  // $FlowIgnore
  atom.config.resetUserSettings = (newSettings, options = {}) => {
    // $FlowIgnore
    atom.config._resetSettings(newSettings, options);
  };

  // $FlowIgnore
  atom.config.resetProjectSettings = (newSettings, projectFile) => {
    // Sets the scope and source of all project settings to `path`.
    // eslint-disable-next-line
    newSettings = Object.assign({}, newSettings);
    // $FlowIgnore
    const oldProjectFile = atom.config.projectFile;
    // $FlowIgnore
    atom.config.projectFile = projectFile;
    if (atom.config.projectFile != null) {
      // $FlowIgnore
      atom.config._resetSettings(newSettings, {
        source: atom.config.projectFile,
      });
    } else {
      // $FlowIgnore
      atom.config.scopedSettingsStore.removePropertiesForSource(oldProjectFile);
      // $FlowIgnore
      atom.config.projectSettings = {};
    }
  };

  // $FlowIgnore
  atom.config.clearProjectSettings = () => {
    // $FlowIgnore
    atom.config.resetProjectSettings({}, null);
  };

  // $FlowIgnore
  atom.config.priorityForSource = source => {
    switch (source) {
      // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
      case atom.config.mainSource:
        return 1000;
      /* $FlowFixMe(>=0.86.0) This
       * comment suppresses an error found when Flow v0.86 was
       * deployed. To see the error, delete this comment and
       * run Flow. */
      case atom.config.projectFile:
        return 2000;
      default:
        return 0;
    }
  };

  // $FlowIgnore
  atom.config.resetUserSettings = (newScopedSettings, options = {}) => {
    const source =
      // $FlowIgnore
      options.source == null ? atom.config.mainSource : options.source;

    // $FlowIgnore
    const priority = atom.config.priorityForSource(source);

    // $FlowIgnore
    atom.config.scopedSettingsStore.removePropertiesForSource(source);

    for (const scopeSelector in newScopedSettings) {
      let settings = newScopedSettings[scopeSelector];
      // $FlowIgnore
      settings = atom.config.makeValueConformToSchema(null, settings, {
        suppressException: true,
      });
      const validatedSettings = {};
      validatedSettings[scopeSelector] = withoutEmptyObjects(settings);
      if (validatedSettings[scopeSelector] != null) {
        // $FlowIgnore
        atom.config.scopedSettingsStore.addProperties(
          source,
          validatedSettings,
          {
            priority,
          },
        );
      }
    }
    // $FlowIgnore
    return atom.config.emitChangeEvent();
  };
};

class ScopeDescriptor {
  static fromObject(scopes) {
    if (scopes != null && Array.isArray(scopes.scopes)) {
      return scopes;
    } else {
      return new ScopeDescriptor({scopes});
    }
  }

  /*
  Section: Construction and Destruction
  */

  // Public: Create a {ScopeDescriptor} object.
  //
  // * `object` {Object}
  //   * `scopes` {Array} of {String}s
  constructor({scopes}) {
    // $FlowIgnore
    this.scopes = scopes;
  }

  // Public: Returns an {Array} of {String}s
  getScopesArray() {
    // $FlowIgnore
    return this.scopes;
  }

  getScopeChain() {
    // For backward compatibility, prefix TextMate-style scope names with
    // leading dots (e.g. 'source.js' -> '.source.js').
    // $FlowIgnore
    if (this.scopes[0] != null ? this.scopes[0].includes('.') : undefined) {
      let result = '';
      // $FlowIgnore
      for (let i = 0; i < this.scopes.length; i++) {
        // $FlowIgnore
        const scope = this.scopes[i];
        if (i > 0) {
          result += ' ';
        }
        if (scope[0] !== '.') {
          result += '.';
        }
        result += scope;
      }
      return result;
    } else {
      // $FlowIgnore
      return this.scopes.join(' ');
    }
  }

  toString() {
    return this.getScopeChain();
  }

  isEqual(other) {
    // $FlowIgnore
    if (this.scopes.length !== other.scopes.length) {
      return false;
    }
    for (let i = 0; i < this.scopes.length; i++) {
      const scope = this.scopes[i];
      if (scope !== other.scopes[i]) {
        return false;
      }
    }
    return true;
  }
}

const ESCAPED_DOT = /\\\./g;

function splitKeyPath(keyPath) {
  if (keyPath == null) {
    return [];
  }

  let startIndex = 0;
  const keyPathArray = [];
  for (let i = 0, len = keyPath.length; i < len; i++) {
    const char = keyPath[i];
    if (char === '.' && (i === 0 || keyPath[i - 1] !== '\\')) {
      keyPathArray.push(
        keyPath.substring(startIndex, i).replace(ESCAPED_DOT, '.'),
      );
      startIndex = i + 1;
    }
  }
  keyPathArray.push(
    keyPath.substr(startIndex, keyPath.length).replace(ESCAPED_DOT, '.'),
  );

  return keyPathArray;
}

function deleteValueAtKeyPath(o, keyPath) {
  let object = o;
  const keys = splitKeyPath(keyPath);
  while (keys.length > 1) {
    const key = keys.shift();
    if (object[key] == null) {
      return;
    }
    // eslint-disable-next-line
    object = object[key];
  }
  delete object[keys.shift()];
}

function setValueAtKeyPath(o, keyPath, value) {
  let object = o;
  const keys = splitKeyPath(keyPath);
  while (keys.length > 1) {
    const key = keys.shift();
    if (object[key] == null) {
      object[key] = {};
    }
    // eslint-disable-next-line
    object = object[key];
  }
  object[keys.shift()] = value;
}

const getValueAtKeyPath = (o, keyPath) => {
  let object = o;

  if (!keyPath) {
    return object;
  }

  const keys = splitKeyPath(keyPath);
  for (let i = 0, len = keys.length; i < len; i++) {
    const key = keys[i];
    // eslint-disable-next-line
    object = object[key];
    if (object == null) {
      return object;
    }
  }
  return object;
};

const withoutEmptyObjects = o => {
  const object = o;
  let resultObject;
  if (isPlainObject(object)) {
    for (const key in object) {
      const value = object[key];
      const newValue = withoutEmptyObjects(value);
      if (newValue != null) {
        if (resultObject == null) {
          resultObject = {};
        }
        resultObject[key] = newValue;
      }
    }
  } else {
    resultObject = object;
  }
  return resultObject;
};

const isEqual = (x, y) => {
  if (
    typeof x === 'object' &&
    x != null &&
    (typeof y === 'object' && y != null)
  ) {
    if (Object.keys(x).length !== Object.keys(y).length) {
      return false;
    }
    for (const prop in x) {
      if (y.hasOwnProperty(prop)) {
        if (!isEqual(x[prop], y[prop])) {
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  } else if (x !== y) {
    return false;
  } else {
    return true;
  }
};
