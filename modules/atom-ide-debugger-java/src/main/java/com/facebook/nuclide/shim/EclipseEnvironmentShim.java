/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import java.nio.charset.StandardCharsets;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.jdt.core.IJavaElement;

public class EclipseEnvironmentShim extends AbstractEclipseEnvironmentShim {
  private final IJavaElement _element;

  public EclipseEnvironmentShim(IJavaElement element) {
    _element = element;
  }

  @Override
  public String getDefaultCharset() {
    return StandardCharsets.UTF_8.name();
  }

  @Override
  public int getType() {
    return IResource.PROJECT;
  }

  @Override
  public boolean hasNature(String string) throws CoreException {
    return string.equals("org.eclipse.jdt.core.javanature");
  }
}
