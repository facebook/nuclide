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

import invariant from 'assert';
import featureConfig from 'nuclide-commons-atom/feature-config';

const NUCLIDE_ONBOARDING_CONFIG_KEY = 'fb-nuclide-onboarding';
const NUCLIDE_ONBOARDING_TOPIC_NAME = 'fb-nuclide-welcome-page';

export function getHiddenTopics(): Set<string> {
  const topics: ?Array<string> = (featureConfig.get(
    'nuclide-welcome-page.hiddenTopics',
  ): any);
  return new Set(topics);
}

export function setHiddenTopics(hiddenTopics: Set<string>): void {
  featureConfig.set(
    'nuclide-welcome-page.hiddenTopics',
    Array.from(hiddenTopics),
  );
}

// Migrate showOnboarding value to welcome-page hiddenTopics if Onboarding
// has already been hidden (stored value === false), and remove
// NUCLIDE_ONBOARDING_CONFIG_KEY from atom config if it exists
export function migrateShowOnboardingConfigValue() {
  let nuclideConfig = atom.config.get('nuclide');
  invariant(nuclideConfig != null && typeof nuclideConfig === 'object');
  const nuclideOnboardingConfig = nuclideConfig[NUCLIDE_ONBOARDING_CONFIG_KEY];
  if (nuclideOnboardingConfig == null) {
    return;
  }
  if (nuclideOnboardingConfig.showOnboarding === false) {
    const hiddenTopics = getHiddenTopics();
    if (!hiddenTopics.has(NUCLIDE_ONBOARDING_TOPIC_NAME)) {
      hiddenTopics.add(NUCLIDE_ONBOARDING_TOPIC_NAME);
      setHiddenTopics(hiddenTopics);
      nuclideConfig = atom.config.get('nuclide');
    }
  }
  // Remove NUCLIDE_ONBOARDING_CONFIG_KEY from atom config
  invariant(nuclideConfig != null && typeof nuclideConfig === 'object');
  delete nuclideConfig[NUCLIDE_ONBOARDING_CONFIG_KEY];
  atom.config.set('nuclide', nuclideConfig);
}
