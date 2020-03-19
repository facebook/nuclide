/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.Location;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.json.JSONObject;

/** Manages the source files parsed. */
public class FileManager {
  // ScriptId => SourceFileSpec.
  private final ConcurrentMap<String, SourceFileSpec> _registeredFiles = new ConcurrentHashMap<>();
  private final ContextManager _contextManager;

  // Prefix unknown file paths with a bogus protocol specific to the debugger.
  // This will prevent Nuclide from actually trying to open the path in the editor.
  private final String DEFAULT_UNKNOWN_SOURCE_PATH =
      SourceFileSpec.SOURCE_NOT_FOUND_PREFIX + "(Unknown)";

  FileManager(ContextManager contextManager) {
    _contextManager = contextManager;
  }

  public SourceFileSpec register(Optional<Location> location) {
    Optional<String> originalSourcePath = Utils.getSourcePathFromLocation(location);
    String scriptId =
        originalSourcePath.isPresent() ? originalSourcePath.get() : DEFAULT_UNKNOWN_SOURCE_PATH;
    String resolvedSourcePath = resolveSourcePath(originalSourcePath);
    return register(resolvedSourcePath, scriptId);
  }

  public SourceFileSpec register(String sourceFilePath, String scriptId) {
    return _registeredFiles.computeIfAbsent(
        scriptId,
        id -> {
          SourceFileSpec sourceFile = new SourceFileSpec(scriptId, sourceFilePath);
          sendScriptParsed(sourceFile);
          return sourceFile;
        });
  }

  public Optional<String> getSourceFilePathForLocation(Location location)
      throws AbsentInformationException {
    Optional<String> path = getSourcePathForScriptId(location.sourcePath());
    if (!path.isPresent()) {
      // If the script ID isn't registered, try to register it and then attempt the lookup again.
      register(Optional.of(location));
      path = getSourcePathForScriptId(location.sourcePath());
    }

    return path;
  }

  public Optional<String> getSourcePathForScriptId(String scriptId) {
    final SourceFileSpec spec = _registeredFiles.get(scriptId);
    if (spec == null) {
      // Script ID is not registered yet.
      return Optional.empty();
    }

    final String url = spec.getUrl();

    // If the source file path was known, this will be a protocl URL starting with file://
    // We need to convert this back to a local file path.
    // Note: Not using URI class here because it doesn't handle Win32 file:// URIs correctly if
    //   they contain \'s, which is legal on Windows.
    if (url.startsWith("file://")) {
      return Optional.of(url.substring(7));
    }

    return Optional.of(url);
  }

  public String getSourceForLocation(Location location) throws AbsentInformationException {
    return getSourceForLocalPath(getSourceFilePathForLocation(location));
  }

  public String getSourceForLocalPath(Optional<String> path) {
    if (!path.isPresent()) {
      return "";
    }

    try {
      return new String(Files.readAllBytes(Paths.get(path.get())));
    } catch (IOException ex) {
      return "";
    }
  }

  public void sourcePathsChanged() {
    // If the paths chagned, any previously computed source file specs are no longer valid.
    _registeredFiles.clear();
  }

  // Resolve the original symbol info in location into real file in file system.
  private String resolveSourcePath(Optional<String> originalSourcePath) {
    if (!originalSourcePath.isPresent()) {
      return DEFAULT_UNKNOWN_SOURCE_PATH;
    }

    Optional<File> file =
        _contextManager.getSourceLocator().findSourceFile(originalSourcePath.get());
    return file.isPresent() ? file.get().getPath() : originalSourcePath.get();
  }

  private void sendScriptParsed(SourceFileSpec file) {
    JSONObject params = new JSONObject();
    params.put("scriptId", file.getScriptId());
    params.put("url", file.getUrl());
    params.put("startLine", 0);
    params.put("startColumn", 0);
    params.put("endLine", file.getSourceFileLength());
    params.put("endColumn", 0);

    JSONObject message = new JSONObject();
    message.put("method", "Debugger.scriptParsed");
    message.put("params", params);

    NotificationChannel channel = _contextManager.getNotificationChannel();
    if (channel instanceof VsDebugAdapterChannelManager) {
      // Debugger.scriptParsed notification can be translated to LoadedSourceEvent but not needed
    } else {
      channel.send(message.toString());
    }
  }
}
