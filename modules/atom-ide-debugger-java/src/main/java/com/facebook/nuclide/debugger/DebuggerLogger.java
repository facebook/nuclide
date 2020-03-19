/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import java.io.File;
import java.nio.file.NoSuchFileException;
import java.nio.file.Paths;
import java.util.logging.FileHandler;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.logging.SimpleFormatter;

public class DebuggerLogger {
  private Logger _logger;

  private static final String FILE_HANDLER_FAILED_ERROR_MESSAGE =
      "Java Debugger was unable to create a logging file.\n"
          + "Please file a bug with the bugnub and attach a screenshot of this output.\n"
          + "The Java Debugger should still be completely usable.";

  // Maximum size of any log file before rolling over to the next file.
  private static final int LOG_FILE_SIZE_MAX = 1 * 1024 * 1024; // 1MB

  // Maximum number of log files to keep in rotation.
  private static final int LOG_FILE_COUNT_MAX = 10;

  public DebuggerLogger(Level logLevel) {
    _logger = Logger.getLogger("JavaDebugServer");
    _logger.setUseParentHandlers(false);
    try {
      File tempDir = new File(System.getProperty("java.io.tmpdir"));
      String user = System.getProperty("user.name");
      String logDirName = String.format("nuclide-%s-logs", user);
      String logFilePath =
          Paths.get(tempDir.getPath(), logDirName, "JavaDebuggerServer.log").toString();
      NoSuchFileException fileHandlerFailed = null;
      try {

        FileHandler fileHandler =
            new FileHandler(logFilePath, LOG_FILE_SIZE_MAX, LOG_FILE_COUNT_MAX, false);
        fileHandler.setFormatter(new SimpleFormatter());
        fileHandler.setLevel(Level.ALL);
        _logger.addHandler(fileHandler);
      } catch (NoSuchFileException e) {
        fileHandlerFailed = e;
      }

      _logger.setLevel(Level.ALL);
      if (fileHandlerFailed != null) {
        Utils.logException(FILE_HANDLER_FAILED_ERROR_MESSAGE, fileHandlerFailed);
      } else {
        logVerbose("File logging enabled. Destination logfile: " + logFilePath);
      }
    } catch (Exception e) {
      // Don't treat this as fatal. Debugger should continue working even if logging is not.
    }
  }

  public synchronized void logInfo(String message) {
    _logger.info(message);
  }

  public synchronized void logWarning(String message) {
    _logger.warning(message);
  }

  public synchronized void logError(String message) {
    _logger.severe(message);
  }

  public synchronized void logVerbose(String message) {
    _logger.fine(message);
  }

  public synchronized void logException(
      String message, String verboseErrorDataForException, boolean verbose) {
    String msg = message + System.lineSeparator() + verboseErrorDataForException;
    if (verbose) {
      logVerbose(msg);
    } else {
      logError(msg);
    }
  }
}
