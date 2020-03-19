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

import type {WorkingSetDefinition} from './types';

import {getLogger} from 'log4js';
import featureConfig from 'nuclide-commons-atom/feature-config';
// @fb-only: import maybeConvertWorkingSets from './fb-convertODWorkingSets';

const CONFIG_KEY = 'nuclide-working-sets.workingSets';

export type DefinitionsObserver = (
  definitions: Array<WorkingSetDefinition>,
) => void;

export class WorkingSetsConfig {
  observeDefinitions(callback: DefinitionsObserver): IDisposable {
    const wrapped = (definitions: any) => {
      // Got to create a deep copy, otherwise atom.config invariants might break
      const copiedDefinitions = definitions.map(def => {
        return {...def, sourceType: 'user'};
      });

      // @fb-only: maybeConvertWorkingSets(copiedDefinitions, callback);
      callback(copiedDefinitions); // @oss-only
    };

    return featureConfig.observe(CONFIG_KEY, wrapped);
  }

  getDefinitions(): Array<WorkingSetDefinition> {
    return (featureConfig.get(CONFIG_KEY): any);
  }

  setDefinitions(definitions: Array<WorkingSetDefinition>): void {
    const userDefinitions = definitions
      .filter(d => d.sourceType === 'user')
      .map(def_ => {
        const def = {...def_};
        delete def.sourceType; // No need to write this.
        return def;
      });
    if (userDefinitions.length === 0) {
      const previousDefinitions = this.getDefinitions();
      if (
        !Array.isArray(previousDefinitions) ||
        previousDefinitions.length > 0
      ) {
        getLogger('nuclide-working-sets').warn(
          `\
Saving empty working sets.
Previous:
${JSON.stringify(previousDefinitions, null, 2)}
Next:
${JSON.stringify(definitions, null, 2)}`,
          new Error('Working Sets Debug Error'),
        );
      }
    }
    featureConfig.set(CONFIG_KEY, userDefinitions);
  }
}
