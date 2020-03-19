/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import java.io.File;
import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;
import org.json.JSONObject;

/** Responsible for locating source file using class/source file paths. */
public class SourceLocator {
  private static final String DEFAULT_ANDROID_SDK = "/opt/android_sdk";
  private static final String JS_DIR = "/js/";
  // TODO: use ReadWriteLock if perf is an issue.
  private final Object _sourceSearchPathsLock = new Object();
  private final Set<String> _sourceSearchPaths = new HashSet<>();
  private final Set<String> _binarySearchPaths = new HashSet<>();
  private final ContextManager _contextManager;

  public SourceLocator(ContextManager contextManager) {
    _contextManager = contextManager;

    // Add the JDK jars so we can resolve things that are typically assumed
    // to be included for javac by bootclasspath.
    String javaHome = getJavaHomePath();
    if (javaHome != null) {
      String jrePath = Paths.get(javaHome, "jre").toString();
      try {
        if (new File(jrePath).exists()) {
          addPotentialPath(jrePath, true);
        }
      } catch (Exception e) {
        Utils.logException("Cannot add JRE jars to classpath:", e);
      }

      String javaLibPath = Paths.get(javaHome, "lib").toString();
      try {
        if (new File(javaLibPath).exists()) {
          addPotentialPath(javaLibPath, true);
        }
      } catch (Exception e) {
        Utils.logException("Cannot add JDK lib jars to classpath:", e);
      }
    }

    // Add the Android SDK to the source and class search path if we can find it.
    String androidHome =
        Optional.ofNullable(System.getenv("ANDROID_SDK")).orElse(DEFAULT_ANDROID_SDK);
    addPotentialPath(Paths.get(androidHome, "platforms").toString(), true);
    addPotentialPath(Paths.get(androidHome, "extras").toString(), true);

    // On Windows, Android studio unpacks sources to per-user local app data.
    String appData = System.getenv("LOCALAPPDATA");
    if (appData != null) {
      addSourcesFromAndroidSdk(Paths.get(appData, "Android", "sdk").toString());
    }
  }

  private void addSourcesFromAndroidSdk(String androidHome) {
    File sources = new File(Paths.get(androidHome, "sources").toString());
    if (sources.exists()) {
      File[] directories = sources.listFiles(File::isDirectory);
      Arrays.stream(directories)
          .parallel()
          .map(File::getPath)
          .forEach(
              filePath -> {
                addPotentialPath(filePath, true);
                addPotentialPath(Paths.get(filePath, "java").toString(), true);
              });
    }
  }

  /** @param classPath class paths separated with ";". */
  public void setClassPath(String classPath) {
    addPaths(classPath.split(";"));
  }

  /** @param sourcePath source paths separated with ";". */
  public void setSourcePath(String sourcePath) {
    if (sourcePath != null && !sourcePath.equals("")) {
      addPaths(sourcePath.split(";"));
    }
  }

  /** Add single potential source search path. */
  public void addPotentialPath(String filePath) {
    addPotentialPath(filePath, false);
  }

  private void addPotentialPath(String filePath, boolean libraryPath) {
    File f = new File(filePath);
    if (!f.exists()) {
      // Only add existing paths.
      Utils.logVerbose("Not adding potential source path (directory does not exist): " + filePath);
      return;
    }

    if (!f.isDirectory()) {
      f = f.getParentFile();
    }

    String scanPath = libraryPath ? f.toPath().toString() : findBuckOut(filePath);
    if (scanPath != null) {
      if (addBinaryPath(scanPath)) {

        // Add any jars under the search path to the binary classpath
        // the evaluation manager will use. This can be done totally asynchronously
        // from the web socket request we're currently handling. Hand it off
        // to a background thread and it completes whenever it completes.
        //
        // Evaluation will work immediately, but type resolution will get
        // better once this operation is finished.
        Thread t =
            new Thread(
                new Runnable() {
                  @Override
                  public void run() {
                    int count = _binarySearchPaths.size();
                    try {
                      Path path = Paths.get(scanPath);
                      Files.walkFileTree(
                          path,
                          new SimpleFileVisitor<Path>() {

                            @Override
                            public FileVisitResult visitFile(Path p, BasicFileAttributes attribs) {
                              String candidate = p.toString();

                              // Add only jar files, and skip some patterns that are likely
                              // to be useless to the evaluation engine to save time and space.
                              if (candidate.endsWith(".jar")
                                  && !candidate.endsWith(".dex.jar")
                                  && !candidate.endsWith("-javadoc.jar")
                                  && !candidate.endsWith("-sources.jar")) {

                                addBinaryPath(candidate);
                              }

                              return FileVisitResult.CONTINUE;
                            }
                          });
                    } catch (IOException e) {
                      // TODO (goom): Surface a message to the user indicating which file paths were
                      //   not traversed
                      Utils.logVerboseException("Error walking file tree:", e);
                    } finally {
                      Utils.logVerbose(
                          "Added "
                              + (_binarySearchPaths.size() - count)
                              + " binaries to the classpath.\n"
                              + "Classpath now contains "
                              + _binarySearchPaths.size()
                              + " binaries.");
                    }
                  }
                });

        t.setDaemon(true);
        t.setName("Classpath searcher - " + filePath);
        t.start();
      }
    }

    addPath(f.toPath().toString());
  }

  private boolean addBinaryPath(String path) {
    synchronized (_sourceSearchPathsLock) {
      if (!_binarySearchPaths.contains(path)) {
        _binarySearchPaths.add(path);
        return true;
      }
    }

    return false;
  }

  private String findBuckOut(String path) {
    // Searches for a buck-out directory for the specified source search path.
    // buck-out is a sub directory of the root of the project tree, which may
    // be above path if the user's working root is set somewhere within the
    // path tree.
    try {
      File file = new File(path);
      while (file != null && file.exists()) {
        File buckOut = new File(Paths.get(file.getPath(), "buck-out").toString());
        if (buckOut.exists()) {
          return buckOut.getCanonicalPath();
        }

        // No buck out in this directory, move up to its parent.
        file = file.getParentFile();
      }
    } catch (IOException e) {
      return null;
    }

    return null;
  }

  private String getJavaHomePath() {
    // Unfortunately the way to find Java home varies wildly between platforms.
    String os = System.getProperty("os.name").toLowerCase();
    if (os.indexOf("win") >= 0) {
      // Windows
      return System.getenv("JAVA_HOME");
    } else if (os.indexOf("mac") >= 0) {
      // MacOS
      return Utils.shellExec("/usr/libexec/java_home");
    } else {
      // Assume Linux.
      String java = Utils.shellExec("which java");
      try {
        return new File(java).getParentFile().getCanonicalPath();
      } catch (IOException e) {
        return null;
      }
    }
  }

  public String[] getBinaryJarPaths() {
    synchronized (_sourceSearchPathsLock) {
      return _binarySearchPaths.toArray(new String[_binarySearchPaths.size()]);
    }
  }

  public String[] getSourceSearchPaths() {
    synchronized (_sourceSearchPathsLock) {
      return _sourceSearchPaths.toArray(new String[_sourceSearchPaths.size()]);
    }
  }

  /** Search source file for input originalSourceFilePath. */
  public Optional<File> findSourceFile(String originalSourceFilePath) {
    Optional<File> sourceFile = findSourceFileH(originalSourceFilePath);
    if (sourceFile.isPresent()) {
      return sourceFile;
    }
    int indexOfJs = originalSourceFilePath.indexOf(JS_DIR);
    if (indexOfJs >= 0) {
      String transposedSourceFilePath =
          originalSourceFilePath.substring(indexOfJs + JS_DIR.length());
      sourceFile = findSourceFileH(transposedSourceFilePath);
      if (sourceFile.isPresent()) {
        return sourceFile;
      }
    }
    JSONObject values = new JSONObject();
    values.put("originalSourceFilePath", originalSourceFilePath);
    _contextManager.sendTelemetryEvent("atom-ide-debugger-java-findSourceFile-failed", values);
    return Optional.empty();
  }

  private Optional<File> findSourceFileH(String originalSourceFilePath) {
    synchronized (_sourceSearchPathsLock) {
      return _sourceSearchPaths
          .stream()
          .map(sourceSearchPath -> new File(sourceSearchPath, originalSourceFilePath))
          .filter(File::exists)
          .findFirst();
    }
  }

  private void addPaths(String[] paths) {
    Stream.of(paths).forEach(this::addPotentialPath);
  }

  private void addPath(String path) {
    synchronized (_sourceSearchPathsLock) {
      if (!_sourceSearchPaths.contains(path)) {
        Utils.logVerbose("Adding source lookup path: " + path);
        _sourceSearchPaths.add(path);

        FileManager fm = _contextManager.getFileManager();
        if (fm != null) {
          fm.sourcePathsChanged();
        }
      }
    }
  }
}
