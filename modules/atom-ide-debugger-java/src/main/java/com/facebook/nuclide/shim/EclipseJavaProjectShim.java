/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import java.util.Map;
import org.eclipse.core.resources.IResource;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.JavaCore;

public class EclipseJavaProjectShim extends AbstractEclipseJavaProjectShim {

  @Override
  public int getElementType() {
    return IJavaElement.JAVA_PROJECT;
  }

  @Override
  public String getOption(String optionName, boolean inheritJavaCoreOptions) {

    if (optionName.equals(JavaCore.COMPILER_SOURCE)
        || optionName.equals(JavaCore.COMPILER_COMPLIANCE)) {
      return "1.8";
    }

    return JavaCore.getOption(optionName);
  }

  @Override
  public Map getOptions(boolean inheritJavaCoreOptions) {
    final Map<String, String> options = JavaCore.getOptions();
    JavaCore.setComplianceOptions(JavaCore.VERSION_1_8, options);
    return options;
  }

  @Override
  public IResource getResource() {
    return new EclipseEnvironmentShim(this);
  }
}
