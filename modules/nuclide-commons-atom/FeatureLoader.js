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

import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import featureConfig from './feature-config';

type FeaturePkg = {
  atomConfig?: Object,
  consumedServices?: Object,
  description?: string,
  name: string,
  nuclide?: {
    config?: Object,
  },
  providedServices?: Object,
};

export type Feature = {
  dirname: string,
  pkg: FeaturePkg,
};

type FeatureLoaderParams = {
  pkgName: string,
  features: Array<Feature>,
};

export default class FeatureLoader {
  _activationDisposable: ?UniversalDisposable;
  _loadDisposable: UniversalDisposable;

  _config: Object;
  _features: Array<Feature>;
  _pkgName: string;

  constructor({config, features, pkgName}: FeatureLoaderParams) {
    this._features = features;
    this._loadDisposable = new UniversalDisposable();
    this._pkgName = pkgName;
    this._config = {
      use: {
        type: 'object',
        collapsed: true,
        properties: {},
      },
    };
  }

  // Build the config. Should occur with root package's load
  load(): void {
    invariant(!this._loadDisposable.disposed);

    // Add a dummy deserializer. This forces Atom to load Nuclide's main module
    // (this file) when the package is loaded, which is super important because
    // this module loads all of the Nuclide features. We could accomplish the same
    // thing by unsetting [the local storage value][1] that Atom uses to indicate
    // whether the main module load can be deferred, however, that would mean that
    // (for a brief time, at least), the flag would be set. If there were an error
    // during that time and we never got a chance to unset the flag, Nuclide
    // features would never load again!
    //
    // [1] https://github.com/atom/atom/blob/v1.9.8/src/package.coffee#L442
    this._loadDisposable.add(
      atom.deserializers.add({
        name: `${this._pkgName}.ForceMainModuleLoad`,
        deserialize() {},
      }),
    );

    //
    // Build the "config" object. This determines the config defaults and
    // it's what is shown by the Settings view. It includes:
    // (1) An entry to enable/disable each feature - called "${pkgName}.use.*".
    // (2) Each feature's merged config.
    //
    // https://atom.io/docs/api/latest/Config
    //
    this._features.forEach(feature => {
      const featurePkg = feature.pkg;
      const name = featurePkg.name;

      // Sample packages are disabled by default. They are meant for development
      // use only, and aren't included in Nuclide builds.
      const enabled = !name.startsWith('sample-');

      // Entry for enabling/disabling the feature
      const setting = {
        title: `Enable the "${name}" feature`,
        description: featurePkg.description || '',
        type: 'boolean',
        default: enabled,
      };
      if (featurePkg.providedServices) {
        const provides = Object.keys(featurePkg.providedServices).join(', ');
        setting.description += `<br/>**Provides:** _${provides}_`;
      }
      if (featurePkg.consumedServices) {
        const consumes = Object.keys(featurePkg.consumedServices).join(', ');
        setting.description += `<br/>**Consumes:** _${consumes}_`;
      }
      this._config.use.properties[name] = setting;

      // Merge in the feature's config
      const featurePkgConfig =
        featurePkg.atomConfig ||
        (featurePkg.nuclide && featurePkg.nuclide.config);

      if (featurePkgConfig) {
        this._config[name] = {
          type: 'object',
          collapsed: true,
          properties: {},
        };
        Object.keys(featurePkgConfig).forEach(key => {
          this._config[name].properties[key] = {
            ...featurePkgConfig[key],
            title: featurePkgConfig[key].title || key,
          };
        });
      }
    });
    featureConfig.setPackageName(this._pkgName);

    // Nesting loads within loads leads to reverse activation order- that is, if
    // the root package loads feature packages, then the feature package activations will
    // happen before the root package's. So we wait until the root package is done loading,
    // but before it activates, to load the features.
    const initialLoadDisposable = atom.packages.onDidLoadPackage(pack => {
      if (pack.name !== this._pkgName) {
        return;
      }

      // Load all the features. This needs to be done during Atom's load phase to
      // make sure that deserializers are registered, etc.
      // https://github.com/atom/atom/blob/v1.1.0/src/atom-environment.coffee#L625-L631
      // https://atom.io/docs/api/latest/PackageManager
      this._features.forEach(feature => {
        // Config defaults are not merged with user defaults until activate. At
        // this point `atom.config.get` returns the user set value. If it's
        // `undefined`, then the user has not set it.
        const enabled = atom.config.get(this.useKeyPathForFeature(feature));
        const shouldEnable = enabled == null
          ? this._config.use.properties[feature.pkg.name].default
          : enabled;

        if (shouldEnable) {
          atom.packages.loadPackage(feature.dirname);
        }
      });

      invariant(initialLoadDisposable != null);
      this._loadDisposable.remove(initialLoadDisposable);
      initialLoadDisposable.dispose();
    });

    this._loadDisposable.add(initialLoadDisposable);
  }

  activate(): void {
    invariant(this._activationDisposable == null);

    const rootPackage = atom.packages.getLoadedPackage(this._pkgName);
    invariant(rootPackage != null);

    // This is a failsafe in case the `.ForceMainModuleLoad` deserializer
    // defined above does not register in time, or if the defer key has been set
    // w/o our knowledge. This can happen during OSS upgrades.
    localStorage.removeItem(
      rootPackage.getCanDeferMainModuleRequireStorageKey(),
    );

    this._features.forEach(feature => {
      if (atom.config.get(this.useKeyPathForFeature(feature))) {
        atom.packages.activatePackage(feature.dirname);
      }
    });

    // Watch the config to manage toggling features
    this._activationDisposable = new UniversalDisposable(
      ...this._features.map(feature =>
        atom.config.onDidChange(this.useKeyPathForFeature(feature), event => {
          if (event.newValue === true) {
            atom.packages.activatePackage(feature.dirname);
          } else if (event.newValue === false) {
            safeDeactivate(feature);
          }
        }),
      ),
    );
  }

  deactivate(): void {
    invariant(
      this._activationDisposable && !this._activationDisposable.disposed,
    );

    this._features.forEach(feature => {
      // Deactivate the package, but don't serialize. That needs to be done in a separate phase so that
      // we don't end up disconnecting a service and then serializing the disconnected state.
      safeDeactivate(feature, true);
    });

    invariant(this._activationDisposable); // reasserting for flow
    this._activationDisposable.dispose();
    this._activationDisposable = null;
  }

  getConfig(): Object {
    return this._config;
  }

  serialize(): void {
    // When the root package is serialized, all of its features need to be serialized. This is an abuse of
    // `serialize()` since we're using it to do side effects instead of returning the serialization,
    // but it ensures that serialization of the Atom packages happens at the right point in the
    // package lifecycle. Unfortunately, it also means that Nuclide features will be serialized twice
    // on deactivation.
    this._features.forEach(safeSerialize);
  }

  useKeyPathForFeature(feature: Feature): string {
    return `${this._pkgName}.use.${feature.pkg.name}`;
  }
}

function safeDeactivate(
  feature: Feature,
  suppressSerialization: boolean = false,
) {
  const name = feature.pkg.name;
  try {
    const pack = atom.packages.getLoadedPackage(name);
    if (pack != null) {
      atom.packages.deactivatePackage(name, suppressSerialization);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Error deactivating "${name}": ${err.message}`);
  }
}

function safeSerialize(feature: Feature) {
  const name = feature.pkg.name;
  try {
    const pack = atom.packages.getActivePackage(name);
    if (pack != null) {
      // Serialize the package
      atom.packages.serializePackage(pack);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Error serializing "${name}": ${err.message}`);
  }
}
