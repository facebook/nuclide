/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.IncompatibleThreadStateException;
import com.sun.jdi.Location;
import com.sun.jdi.StackFrame;
import com.sun.jdi.ThreadReference;
import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.logging.Level;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/** Static utility class. */
public final class Utils {
  private static DebuggerLogger _logger = null;
  private HashMap<String, String> hintCache = new HashMap<String, String>();

  public enum BreakpointEventReasons {
    NEW("new"),
    CHANGED("changed"),
    REMOVED("removed");

    private String value;

    BreakpointEventReasons(String value) {
      this.value = value;
    }

    public String getValue() {
      return this.value;
    }
  };

  public enum UserMessageLevel {
    TEXT,
    INFO,
    WARNING,
    ERROR
  };

  public Utils() {}

  public static String userMessageLevelToOutputEventCategory(UserMessageLevel level) {
    switch (level) {
      case TEXT:
        return "stdout";
      case INFO:
        return "console";
      case WARNING:
        return "console";
      case ERROR:
        return "stderr";
      default:
        return null;
    }
  }

  public static void initializeLogging(Level logLevel) {
    if (_logger != null) {
      throw new IllegalStateException("Logger is already initialized!");
    }

    _logger = new DebuggerLogger(logLevel);
  }

  public static String getFrameName(StackFrame frame) {
    return String.format(
        "%s.%s+%d",
        frame.location().declaringType().name(),
        frame.location().method().name(),
        frame.location().codeIndex());
  }

  public static ArrayList<String> stringArrayListFrom(JSONArray jsonArray) {
    ArrayList<String> results = new ArrayList<String>();
    for (int i = 0; i < jsonArray.length(); i++) {
      results.add(jsonArray.getString(i));
    }
    return results;
  }

  public static ArrayList<JSONObject> jsonObjectArrayListFrom(JSONArray jsonArray) {
    ArrayList<JSONObject> results = new ArrayList<JSONObject>();
    for (int i = 0; i < jsonArray.length(); i++) {
      results.add(jsonArray.getJSONObject(i));
    }
    return results;
  }

  public static JSONObject getFrameLocationJson(FileManager fileManager, StackFrame frame) {
    SourceFileSpec fileSpec = fileManager.register(Optional.of(frame.location()));
    return getLocationJson(fileSpec.getScriptId(), frame.location().lineNumber());
  }

  public static JSONObject getLocationJson(String scriptId, int lineNumber) {
    JSONObject locationJson = new JSONObject();
    locationJson.put("scriptId", scriptId);
    locationJson.put("lineNumber", lineNumber - 1); // Chrome lineNumber is 0-based.
    locationJson.put("columnNumber", 0); // TODO: JDI does not provide column info?
    return locationJson;
  }

  public static Optional<String> getSourcePathFromLocation(Optional<Location> location) {
    return location.flatMap(
        loc -> {
          try {
            return Optional.of(loc.sourcePath());
          } catch (AbsentInformationException e) {
            return Optional.empty();
          }
        });
  }

  public static JSONArray getThreadStackJson(
      ContextManager contextManager, ThreadReference thread) {
    JSONArray callFrames = new JSONArray();
    try {
      for (StackFrame frame : thread.frames()) {
        SourceFileSpec fileSpec =
            contextManager.getFileManager().register(Optional.of(frame.location()));
        JSONObject callFrameJson = new JSONObject();
        String frameName = Utils.getFrameName(frame);
        callFrameJson.put("callFrameId", frameName);
        callFrameJson.put("functionName", frameName);
        callFrameJson.put(
            "hasSource",
            fileSpec.getUrl().startsWith(SourceFileSpec.SOURCE_NOT_FOUND_PREFIX) ? false : true);
        callFrameJson.put(
            "location", Utils.getFrameLocationJson(contextManager.getFileManager(), frame));
        callFrameJson.put(
            "scopeChain",
            Utils.getLocalsScopeChain(contextManager.getRemoteObjectManager(), frame));
        callFrames.put(callFrameJson);
      }
    } catch (IncompatibleThreadStateException e) {
      // If we fail to get stack frames due to exception, just log the exception
      // and display empty call frames in UI.
      Utils.logException("Failed to get thread info:", e);
    }
    return callFrames;
  }

  public static JSONArray getLocalsScopeChain(
      RemoteObjectManager remoteObjectManager, StackFrame frame) {
    JSONObject localScopeJson = new JSONObject();
    localScopeJson.put("type", "local");

    JSONObject localsJson = null;
    localsJson = remoteObjectManager.registerLocals(frame).getSerializedValue();
    localScopeJson.put("object", localsJson);

    JSONArray scopeChainJson = new JSONArray();
    scopeChainJson.put(localScopeJson);
    return scopeChainJson;
  }

  public static String getFileNameFromPath(String filePath) {
    Path p = Paths.get(filePath);
    return p.getFileName().toString();
  }

  public static String getFilePathFromUrl(String fileUrl) throws IllegalArgumentException {
    URI uri;
    String filePath;
    String fileProtocol = "file://";
    try {
      uri = URI.create(fileUrl);
      filePath = uri.getPath();
    } catch (IllegalArgumentException ex) {
      // URI.create() doesn't accept windows file:// URIs of the form file://C:\...\....
      if (fileUrl.matches(fileProtocol + "[A-Za-z]:[^/:]+")) {
        filePath = fileUrl.substring(fileProtocol.length());
      } else {
        throw ex;
      }
    }

    if (filePath == null) {
      throw new IllegalArgumentException(String.format("Invalid file url: %s", fileUrl));
    }
    return filePath;
  }

  public static void sendBreakpointHitcountNotification(
      ContextManager contextManager, String breakpointId, int hitCount) {
    JSONObject params = new JSONObject();
    params.put("breakpointId", breakpointId);
    params.put("hitCount", hitCount);

    JSONObject notificationJson = new JSONObject();
    notificationJson.put("method", "Debugger.breakpointHitCountChanged");
    notificationJson.put("params", params);

    try {
      sendClientNotification(contextManager, notificationJson);
    } catch (Exception e) {
      Utils.logException("Failed to send breakpoint hit count notification to client:", e);
    }
  }

  public static void sendClientNotification(
      ContextManager contextManager, JSONObject notificationJson) {
    contextManager.getNotificationChannel().send(notificationJson.toString());
  }

  public static void sendUserMessage(
      ContextManager contextManager,
      String message,
      UserMessageLevel level,
      boolean raiseNotification) {

    JSONObject obj = new JSONObject();
    obj.put("notification", true);
    obj.put("level", level.toString().toLowerCase());
    obj.put("message", message);
    obj.put("raiseNotification", raiseNotification);

    sendClientNotification(contextManager, obj);
  }

  public static String packageNameFromClassName(String className) {
    int lastDotIndex = className.lastIndexOf('.');
    if (lastDotIndex <= 0) {
      return "";
    }
    return className.substring(0, lastDotIndex);
  }

  public static String packageRootPathFromFilePath(String filePath, String packageName) {
    if (packageName.isEmpty()) {
      return filePath;
    }
    String packageRelativePath = packageName.replace('.', File.separatorChar);
    int packagePathStartIndex = filePath.lastIndexOf(packageRelativePath);
    if (packagePathStartIndex > 0) {
      return filePath.substring(0, packagePathStartIndex - 1);
    } else {
      Utils.logInfo(
          String.format(
              "File path(%s) does not ends with package name(%s)?", filePath, packageName));
    }
    return filePath;
  }

  public static String getStopReasonString(DebuggerStopReason reason) {
    switch (reason) {
      case SINGLE_STEP:
        return "Debugger step";
      case LOADER_BREAK:
        return "Loader breakpoint";
      case ASYNC_BREAK:
        return "Debugger pause";
      case BREAKPOINT:
        return "Breakpoint hit";
      case EXCEPTION:
        return "Exception thrown";
      default:
        return "";
    }
  }

  public static void logVerbose(String message) {
    _logger.logVerbose(message);
  }

  public static void logInfo(String message) {
    _logger.logInfo(message);
  }

  public static void logWarning(String message) {
    _logger.logWarning(message);
  }

  public static void logError(String message) {
    _logger.logError(message);
  }

  public static void logException(String message, Throwable ex) {
    _logger.logException(message, verboseErrorDataFor(ex), false /* verbose */);
  }

  public static void logVerboseException(String message, Throwable ex) {
    _logger.logException(message, verboseErrorDataFor(ex), true /* verbose */);
  }

  public static void logTrace(ContextManager cm, String message) {
    Utils.logTrace(cm, message, new Throwable());
  }

  public static void logTrace(ContextManager cm, String message, Throwable thr) {
    cm.sendUserMessage(
        message + System.lineSeparator() + verboseErrorDataFor(thr), UserMessageLevel.INFO);
  }

  public static String shellExec(String command) {
    try {
      Process p = Runtime.getRuntime().exec(command);
      p.waitFor();

      try (BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
          sb.append(line);
        }
        return sb.toString();
      }
    } catch (IOException | InterruptedException e) {
      return null;
    }
  }

  public static String getJavaPath() {
    String os = System.getProperty("os.name").toLowerCase();
    if (os.indexOf("win") >= 0) {
      // Windows
      return Paths.get(System.getenv("JAVA_HOME"), "bin", "java").toString();
    } else {
      // Mac and Linux
      return shellExec("which java");
    }
  }

  public static String verboseErrorDataFor(Throwable ex) {
    return ex.toString() + " " + new JSONArray(ex.getStackTrace()).toString(2);
  }

  public String getHintForFilePath(String filePath) {
    String cachedHint = hintCache.get(filePath);
    if (cachedHint != null) {
      return cachedHint;
    }
    Path path = Paths.get(filePath);
    if (!Files.exists(path)) {
      Utils.logError(
          "Breakpoints may not work for the following file because it was not found: " + filePath);
      return null;
    }
    try {
      List<String> data = Files.readAllLines(path);
      Pattern packageRegex = Pattern.compile("^\\s*package\\s+([a-zA-z0-9_.$]+)\\s*;");
      String hint =
          data.stream()
              .map(packageRegex::matcher)
              .map(
                  m -> {
                    if (m.find()) {
                      return m.group(1);
                    } else {
                      return null;
                    }
                  })
              .filter(Objects::nonNull)
              .findFirst()
              .orElse(null);
      if (hint != null) {
        hintCache.put(filePath, hint);
      }
      return hint;
    } catch (IOException ex) {
      Utils.logException("Breakpoints may not work for file: " + filePath, ex);
      return null;
    }
  }
}
