/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import invariant from 'assert';
import featureConfig from 'nuclide-commons-atom/feature-config';

export default function showTriggerConflictWarning(): atom$Notification {
  const triggerKeys = featureConfig.get(
    `hyperclick.${process.platform}TriggerKeys`,
  );
  invariant(typeof triggerKeys === 'string');
  const triggerKeyDescription = getTriggerDescription(triggerKeys);
  const {platform} = process;
  const commandOrMeta = platform === 'darwin' ? 'command' : 'meta';
  const optionOrAlt = platform === 'darwin' ? 'option' : 'alt';
  const alternative =
    triggerKeys === 'altKey,metaKey'
      ? commandOrMeta
      : `${commandOrMeta} + ${optionOrAlt}`;
  return atom.notifications.addInfo(
    `Hyperclick (jump to definition) is using ${triggerKeyDescription}`,
    {
      description:
        `If you want to use ${triggerKeyDescription} for multiple cursors instead,` +
        ' change the Hyperclick "Trigger Keys" setting.<br /><br />' +
        `(You can still use ${alternative} + click for multiple cursors.)`,
      dismissable: true,
    },
  );
}

function getTriggerDescription(trigger: string): string {
  const schema = featureConfig.getSchema(
    `hyperclick.${process.platform}TriggerKeys`,
  );
  invariant(schema != null && schema.enum != null);
  const match = schema.enum.find(option => {
    invariant(option != null && typeof option.value === 'string');
    return option.value === trigger;
  });
  invariant(match != null && typeof match.description === 'string');
  return match.description;
}
