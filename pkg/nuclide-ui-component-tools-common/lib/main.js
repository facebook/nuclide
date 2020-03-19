/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */
import {
  getComponentNameFromUri,
  getDefaultPropNames,
  getLeadingCommentForComponent,
  getRequiredPropsFromAst,
} from './uiComponentAst';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ComponentDefinition} from './types';

export function getComponentDefinitionFromAst(
  fileUri: NuclideUri,
  ast: File,
): ?ComponentDefinition {
  // The component must have a matching file name and component.
  const componentName = getComponentNameFromUri(fileUri);
  if (componentName == null) {
    return null;
  }
  const requiredProps = getRequiredPropsFromAst(componentName, ast);
  if (requiredProps == null) {
    // There is a difference between having no required props and being unable
    // to traverse for required props. If this case is the latter, it probably
    // isn't an actual React component and we wouldn't want to supply the wrong
    // ComponentDefinition.
    return null;
  }
  const defaultProps = getDefaultPropNames(componentName, ast);
  const leadingComment = getLeadingCommentForComponent(componentName, ast);
  return {
    name: componentName,
    requiredProps,
    defaultProps,
    leadingComment,
  };
}
