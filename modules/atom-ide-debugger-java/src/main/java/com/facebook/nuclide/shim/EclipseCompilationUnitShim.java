/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import com.facebook.nuclide.debugger.ContextManager;
import com.facebook.nuclide.debugger.Utils;
import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.ReferenceType;
import java.util.List;
import java.util.Optional;

public class EclipseCompilationUnitShim extends AbstractEclipseCompilationUnitShim {
  private final ContextManager _contextManager;
  private final ReferenceType _refType;

  public EclipseCompilationUnitShim(ReferenceType refType, ContextManager contextManager) {
    _contextManager = contextManager;
    _refType = refType;
  }

  // Attempts to locate the source file that contains the definition of this
  // compilation unit, and return its contents as a String.
  @Override
  public String getSource() {
    try {
      List<String> sourcePaths = _refType.sourcePaths(null);
      if (sourcePaths.size() == 0) {
        // Source file not found.
        return null;
      }

      // Attempt to use the first path we find.
      // TODO: If the JVM reports multiple source files for a type, what do we do?
      String sourcePath = sourcePaths.get(0);
      Optional<String> localPath =
          _contextManager.getFileManager().getSourcePathForScriptId(sourcePath);
      if (localPath.isPresent()) {
        return _contextManager.getFileManager().getSourceForLocalPath(localPath);
      }
    } catch (AbsentInformationException ex) {
      Utils.logException("Couldn't get source:", ex);
    }

    return null;
  }
}
