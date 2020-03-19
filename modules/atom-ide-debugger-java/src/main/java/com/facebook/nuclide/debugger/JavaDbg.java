/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import java.util.logging.Level;

/** Entry point class. */
public class JavaDbg {
  /** Entry point for the whole program. */
  public static void main(String[] args) {
    try {
      Level level = Level.INFO;
      for (String arg : args) {
        if (arg.contains("verbose")) {
          // Set log level to verbose only if specified on command line. This amount
          // of logging slows the debug server down noticably.
          System.err.println("Verbose logging enabled.");
          level = Level.ALL;
        }
      }

      Utils.initializeLogging(level);
      Utils.logInfo("Java Debugger started!");
      Utils.logVerbose("Starting JavaDbg with args:" + String.join(" ", args));

      JavaDebuggerServer debugger = new JavaDebuggerServer();
      debugger.start();
    } catch (Exception e) {
      System.err.println("Java Debugger Stopped: ");
      e.printStackTrace();
    }
  }
}
