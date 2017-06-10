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

import featureConfig from 'nuclide-commons-atom/feature-config';
import {maybeToString} from 'nuclide-commons/string';

type Options = {
  feature: string,
  toolName: string,
  pathSetting: string,
};

type Result = {
  message: string,
  meta: atom$NotificationOptions,
};

const capitalize = str => str[0].toUpperCase() + str.substr(1);

export default function formatEnoentNotification(options: Options): Result {
  const {feature, toolName, pathSetting} = options;
  const schema = featureConfig.getSchema(pathSetting);
  const settingTitle = schema.title;
  const categoryTitle = capitalize(pathSetting.split('.').shift());
  const command: string = (featureConfig.get(pathSetting): any);
  const capitalizedFeature = capitalize(feature);
  const description = `${capitalizedFeature} needs *${toolName}* but Nuclide couldn't find it at \`${command}\`.

**Troubleshooting Tips**
1. Make sure that *${toolName}* is installed. Some Nuclide features require tools that aren't
   bundled with Nuclide. You may need to install this tool yourself.
2. Make sure that *${toolName}* can be run using the command \`${command}\`.
3. Atom doesn't know about PATH modifications made in your shell config (".bash_profile", ".zshrc",
   etc.). If *${toolName}* is installed and you can run it successfully from your terminal using the
   command \`${command}\`, Nuclide may just not be looking in the right place. Update the command by
   changing the **${maybeToString(settingTitle)}** setting (under **${categoryTitle}**) on the
   Nuclide settings page.`;

  return {
    message: `Nuclide couldn't find *${toolName}*!`,
    meta: {
      dismissable: true,
      description,
    },
  };
}
