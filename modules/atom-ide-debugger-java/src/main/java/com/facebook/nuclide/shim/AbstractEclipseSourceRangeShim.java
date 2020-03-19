/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import org.eclipse.jdt.core.ISourceRange;

public abstract class AbstractEclipseSourceRangeShim extends AbstractEclipseShim<ISourceRange>
    implements ISourceRange {

  @Override
  public int getLength() {
    return getProxy().getLength();
  }

  @Override
  public int getOffset() {
    return getProxy().getOffset();
  }
}
