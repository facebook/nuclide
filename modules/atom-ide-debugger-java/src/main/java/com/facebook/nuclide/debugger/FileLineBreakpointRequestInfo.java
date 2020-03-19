/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

class FileLineBreakpointRequestInfo extends BreakpointRequestInfo {
  private final String _filePath;
  private final int _line;
  private final String _packageHint;

  FileLineBreakpointRequestInfo(String filePath, int line, String packageHint) {
    _filePath = filePath;
    _line = line;
    _packageHint = packageHint;
  }

  public String getFilePath() {
    return _filePath;
  }

  public int getLine() {
    return _line;
  }

  public String getPackageHint() {
    return _packageHint;
  }
}
