/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.io.LineNumberReader;

public class SourceFileSpec {
  public static final String SOURCE_NOT_FOUND_PREFIX = "javadbg://";

  private final String _scriptId;
  private final String _sourceFilePath;
  private final boolean _sourceFileExists;
  private final int _sourceFileLength;

  SourceFileSpec(String scriptId, String sourceFilePath) {
    boolean sourceFileExists = false;
    int sourceFileLength = 0;
    File sourceFile = new File(sourceFilePath);
    String canonicalPath = sourceFilePath;

    try {
      if (sourceFile.exists() && !sourceFile.isDirectory() && sourceFile.canRead()) {
        // Count number of lines in the source file to report to debugger frontend.
        LineNumberReader reader = new LineNumberReader(new FileReader(sourceFile));
        reader.skip(Long.MAX_VALUE);
        sourceFileLength = reader.getLineNumber();
        reader.close();
      }

      if (sourceFileLength > 0) {
        canonicalPath = sourceFile.getCanonicalPath();
        sourceFileExists = true;
      }
    } catch (IOException | SecurityException e) {
    }

    _scriptId = scriptId;
    _sourceFilePath = canonicalPath;
    _sourceFileExists = sourceFileExists;
    _sourceFileLength = sourceFileLength;
  }

  public String getScriptId() {
    return _scriptId;
  }

  public boolean getSourceFileExists() {
    return _sourceFileExists;
  }

  // returns the number of lines in the source file.
  public int getSourceFileLength() {
    return _sourceFileLength;
  }

  public String getUrl() {
    if (_sourceFileExists) {
      return "file://" + _sourceFilePath;
    }

    // Cannot find source file. Return a string that Nuclide won't open.
    if (_sourceFilePath.startsWith(SOURCE_NOT_FOUND_PREFIX)) {
      return _sourceFilePath;
    }

    return SOURCE_NOT_FOUND_PREFIX + _sourceFilePath;
  }
}
