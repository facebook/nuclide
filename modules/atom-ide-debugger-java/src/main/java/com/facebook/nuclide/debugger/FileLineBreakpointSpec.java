/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.github.javaparser.*;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.TypeDeclaration;
import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.Location;
import com.sun.jdi.ReferenceType;
import com.sun.jdi.request.ClassPrepareRequest;
import com.sun.jdi.request.EventRequest;
import com.sun.jdi.request.EventRequestManager;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONObject;

/** Source line breakpoint spec. Threading: access from both request and event threads. */
public class FileLineBreakpointSpec extends BreakpointSpec {
  private final FileLineBreakpointRequestInfo _requestInfo;
  private static final ConcurrentHashMap<String, ClassPrepareRequest>
      _classNameToClassPrepareRequest = new ConcurrentHashMap<String, ClassPrepareRequest>();
  private String _className;
  private static final ConcurrentHashMap<String, CompilationUnit> _unitCache =
      new ConcurrentHashMap<String, CompilationUnit>();

  public FileLineBreakpointSpec(
      ContextManager contextManager, FileLineBreakpointRequestInfo locationInfo, String condition) {
    super(contextManager, condition);

    String filePath = locationInfo.getFilePath();
    _requestInfo = locationInfo;
    _className = getClassNameForBreakpoint(filePath);
  }

  private String getClassNameForBreakpoint(String filePath) {
    try {
      int targetLine = _requestInfo.getLine();

      CompilationUnit unit = null;
      if (_unitCache.contains(filePath)) {
        unit = _unitCache.get(filePath);
      } else {
        try (FileInputStream stream = new FileInputStream(filePath)) {
          unit = JavaParser.parse(stream);
          _unitCache.put(filePath, unit);
        } catch (IOException e) {
          // TODO log
        }
      }

      if (unit == null) {
        return "";
      }

      // Find the type declaration that contains the breakpoint line.
      for (TypeDeclaration<?> decl : unit.getTypes()) {
        Optional<Range> r = decl.getRange();
        if (!r.isPresent()) {
          continue;
        }

        String packagePrefix =
            unit.getPackageDeclaration()
                .map(packageDeclaration -> packageDeclaration.getName().toString() + ".")
                .orElse("");
        Position begin = r.get().begin;
        Position end = r.get().end;
        if (begin.line <= targetLine && end.line >= targetLine) {
          return packagePrefix + decl.getName().toString();
        }
      }

      return "";
    } catch (ParseProblemException e) {
      return "";
    }
  }

  @Override
  public void enable() {
    resolveImmediate(_className);
    if (!isResolved()) {
      watchForClassPrepare();
    }
  }

  @Override
  protected void handleBreakpointResolved() {
    // Now that this is resolved, we should have a bound location. Tell the
    // breakpoint manager.
    Optional<Location> location = getBoundLocation();
    if (location.isPresent()) {
      getContextManager().getBreakpointManager().addResolvedBreakpoint(this, location.get());
    }
  }

  /** Watch for future class prepare/load if not resolved yet. */
  private void watchForClassPrepare() {
    // one class prepare request per class name
    if (!_classNameToClassPrepareRequest.containsKey(_className)) {
      EventRequestManager em = getContextManager().getVirtualMachine().eventRequestManager();
      ClassPrepareRequest classPrepareRequest = em.createClassPrepareRequest();
      classPrepareRequest.addClassFilter(_className + "*");
      classPrepareRequest.setSuspendPolicy(EventRequest.SUSPEND_ALL);
      classPrepareRequest.enable();
      _classNameToClassPrepareRequest.put(_className, classPrepareRequest);
    }
  }

  @Override
  protected boolean doesClassMatchBreakpoint(String className) {
    return className.startsWith(_className);
  }

  @Override
  public JSONObject getLocationJson() {
    SourceFileSpec sourceFile =
        getContextManager()
            .getFileManager()
            .register(_requestInfo.getFilePath(), _requestInfo.getFilePath());
    return Utils.getLocationJson(sourceFile.getScriptId(), _requestInfo.getLine());
  }

  @Override
  public int getLine() {
    return _requestInfo.getLine();
  }

  @Override
  protected Optional<Location> getMatchLocationFromClass(ReferenceType refType) {
    try {
      // TODO: handle multiple locations.
      return refType.locationsOfLine(_requestInfo.getLine()).stream().findFirst();
    } catch (AbsentInformationException e) {
      // This type does not have line info, ignore it.
      return Optional.empty();
    }
  }
}
