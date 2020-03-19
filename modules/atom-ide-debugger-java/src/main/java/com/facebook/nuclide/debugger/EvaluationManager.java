/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.facebook.nuclide.shim.EclipseDebugTargetShim;
import com.facebook.nuclide.shim.EclipseJavaProjectShim;
import com.facebook.nuclide.shim.EclipseJavaStackFrameShim;
import com.facebook.nuclide.shim.EclipseShim;
import com.facebook.nuclide.shim.IEclipseValueWrapper;
import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.Field;
import com.sun.jdi.IncompatibleThreadStateException;
import com.sun.jdi.LocalVariable;
import com.sun.jdi.Location;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.ReferenceType;
import com.sun.jdi.StackFrame;
import com.sun.jdi.ThreadReference;
import com.sun.jdi.Value;
import com.sun.jdi.VoidValue;
import java.io.File;
import java.io.OutputStream;
import java.io.PrintStream;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import javassist.ClassPool;
import javassist.CtClass;
import javassist.NotFoundException;
import javax.lang.model.SourceVersion;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.compiler.IProblem;
import org.eclipse.jdt.core.dom.AST;
import org.eclipse.jdt.core.dom.ASTParser;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.debug.core.IJavaDebugTarget;
import org.eclipse.jdt.debug.core.IJavaReferenceType;
import org.eclipse.jdt.debug.core.IJavaStackFrame;
import org.eclipse.jdt.debug.core.IJavaValue;
import org.eclipse.jdt.internal.debug.eval.ast.engine.ASTInstructionCompiler;
import org.eclipse.jdt.internal.debug.eval.ast.engine.EvaluationSourceGenerator;
import org.eclipse.jdt.internal.debug.eval.ast.engine.Interpreter;
import org.eclipse.jdt.internal.debug.eval.ast.engine.RuntimeContext;
import org.eclipse.jdt.internal.debug.eval.ast.instructions.InstructionSequence;

/** Implements Nuclide evaluate on call frame. */
public class EvaluationManager {
  private final ContextManager _contextManager;
  private IJavaProject _project = null;
  private IJavaDebugTarget _target = null;

  public EvaluationManager(ContextManager contextManager) {
    _contextManager = contextManager;
    patchUpEclipseEvaluationEngine();
  }

  // The Eclipse debug plugin we are using here for AST parsing makes various assumptions
  // about the environment it is running in (assuming it is a DebugPlugin running inside the
  // Eclipse platform, with the UX and everything initialized). Patching out some things that
  // don't work so that we can leverage the remaining code.
  private void patchUpEclipseEvaluationEngine() {
    // We don't have access to any preferences service. Replace it with a mock
    // object that returns default values for everything.
    EclipseShim.hotReplaceMethod(
        "org.eclipse.core.runtime.Platform",
        "getPreferencesService",
        EclipseShim.getEmptyMethodBody(
            "(new com.facebook.nuclide.shim.EclipsePreferencesServiceShim())"));

    // Patch up the EvaluationSourceGenerator which makes a bad assumption about
    // the concrete implementation about the IJavaReferenceType it's given.
    EclipseShim.addCatch(
        "org.eclipse.jdt.internal.debug.eval.ast.engine.EvaluationSourceGenerator",
        "getSource",
        "java.lang.ClassCastException",
        "return \"\";");

    EclipseShim.addCatch(
        "org.eclipse.jdt.internal.debug.eval.ast.engine.SourceBasedSourceGenerator",
        "getTypeName",
        "java.lang.Throwable",
        "return \"\";");

    // Add catches to both overloads of org.eclipse.jdt.internal.debug.core.JDIDebugPlugin.
    CtClass[] params = new CtClass[1];
    try {
      params[0] = ClassPool.getDefault().get("java.lang.Throwable");
      EclipseShim.addCatch(
          "org.eclipse.jdt.internal.debug.core.JDIDebugPlugin",
          "log",
          params,
          "java.lang.Throwable",
          "return;");
    } catch (NotFoundException e) {
    }

    try {
      EclipseShim.hotReplaceMethod(
          "org.eclipse.jdt.internal.compiler.lookup.FieldBinding",
          "canBeSeenBy",
          EclipseShim.getEmptyMethodBody("true"));
    } catch (Exception ex) {
    }
  }

  public synchronized void setupEclipseJavaDebugShims() {
    _project = new EclipseJavaProjectShim();
    _target = new EclipseDebugTargetShim(_contextManager);
    Utils.logVerbose("targetShim: " + _target.toString());
  }

  public synchronized Value evaluateOnCallFrame(String frameId, String expression)
      throws Exception {
    StackFrame frame = getStackFrame(frameId);
    return evaluateOnCallFrame(frame, expression);
  }

  public synchronized Value evaluateOnCallFrame(StackFrame frame, String expression)
      throws Exception {
    String trimmedExpression = expression.trim();
    if (!_contextManager.isDebuggerPaused()) {
      throw new IllegalStateException(
          "Failed to evaluate expression: the debugee is currently running.");
    }

    // deal with some special keywords
    if (trimmedExpression.equals("null")) {
      return null;
    } else if (trimmedExpression.equals("true")) {
      return _contextManager.getVirtualMachine().mirrorOf(true);
    } else if (trimmedExpression.equals("false")) {
      return _contextManager.getVirtualMachine().mirrorOf(false);
    }
    if (trimmedExpression.equals("this") && frame != null) {
      ObjectReference thisObj = frame.thisObject();
      if (thisObj != null) {
        return thisObj;
      }
    }

    if (SourceVersion.isKeyword(trimmedExpression)) {
      return _contextManager.getVirtualMachine().mirrorOf(trimmedExpression);
    }

    if (frame == null) {
      throw new IllegalStateException("Error: the specified call frame could not be found");
    }

    // See if the evaluation expression is simply the name of a local in the current frame
    // or a member of the current this pointer. In those cases, we can return the value
    // without resorting to parsing the source.
    try {
      Value localValue = evaluateExpressionAsLocal(frame, trimmedExpression);
      return localValue;
    } catch (IllegalArgumentException e) {
      // Expression is not a simple variable name.
    }

    // Next see if we can evaluate the expression using reflectiion by walking
    // a chain of field accesses
    try {
      Value localValue = evaluateExpressionAsPropertyChain(frame, trimmedExpression);
      if (localValue != null) {
        return localValue;
      }
    } catch (Exception e) {
      // Fall back to the compiler.
    }

    // If the expression is more complicated than just the name of an identifier in the current
    // scope, fallback to using the Eclipse parser and interpreter.
    // First, determine the source location of the current context. Source is required for
    // the evaluation engine to succeed.
    Location frameLocation = frame.location();
    String sourceName = frameLocation.sourceName();
    Optional<String> sourceFilePath =
        _contextManager.getFileManager().getSourceFilePathForLocation(frameLocation);
    String source = _contextManager.getFileManager().getSourceForLocation(frameLocation);
    int lineNumber = frameLocation.lineNumber();
    boolean staticMethod = frameLocation.method().isStatic();
    if (!sourceFilePath.isPresent() || source == null || source.trim().equals("")) {
      throw new IllegalStateException(
          "Error evaluating: source for " + sourceName + " could not be located.");
    }

    // Expression compilation will occur in the context of the current stack frame, and in the type
    // of the "this" object at the current frame location.
    IJavaStackFrame currentStackFrame = getStackFrameProxy(frame);
    IJavaReferenceType receivingType = currentStackFrame.getReferenceType();

    // From now on out, we want trimmedExpression to be wrapped in parens
    // This is because adding parens makes this method from the
    // org.eclipse.jdt.internal.debug.eval.ast.engine.EvaluationSourceGenerator
    // return true: https://fburl.com/qfbqfobo
    trimmedExpression = "(" + trimmedExpression + ")";
    // Gather the types and names of the variables that are in-scope and visible at the eval site.
    // These will be used by the context of the Interpreter to obtain referenced values from the
    // target VM.
    EvaluationScope scope = new EvaluationScope(frame, trimmedExpression);
    String[] referencedTypes = scope.getReferencedTypeNames();
    String[] referencedVariables = scope.getVariableNames();

    EvaluationSourceGenerator generator = null;
    PrintStream oldErr = System.err;
    try {
      // Redirect System.err because EvaluationSourceGenerator sometimes writes directly to
      // System.err and we don't want the user to see that.
      System.err.flush();
      System.setErr(
          new PrintStream(
              new OutputStream() {
                public void write(int b) {
                  // no op
                }
              }));
      // Prepare evaluation source context.
      generator =
          new EvaluationSourceGenerator(
              referencedTypes, referencedVariables, trimmedExpression, _project);
      // Reset System.err back to normal.
      System.err.flush();
      System.setErr(oldErr);
    } catch (Exception ex) {
      // Reset System.err back to normal.
      System.err.flush();
      System.setErr(oldErr);
      throw ex;
    }

    // Generate evaluation source.
    String parsableSource = generator.getSource(receivingType, lineNumber, _project, staticMethod);

    try {
      // Compile the generated source into an AST.
      StringBuilder compilationErrors = new StringBuilder();
      CompilationUnit unit =
          compileSource(parsableSource, sourceFilePath.get(), sourceName, compilationErrors);

      // Compile the AST into an instruction sequence.
      int start = generator.getSnippetStart();
      ASTInstructionCompiler compiler = new ASTInstructionCompiler(start, trimmedExpression);
      try {
        unit.accept(compiler);
      } catch (Throwable ex) {
        Utils.logVerboseException("Error compiling expression", ex);
      }

      // Interpret the compiled expression to determine a result.
      InstructionSequence seq = compiler.getInstructions();
      RuntimeContext runtimeContext = new RuntimeContext(_project, currentStackFrame);
      Interpreter interpreter = new Interpreter(seq, runtimeContext);
      interpreter.execute();

      // Serialize the result of the interpreter.
      IJavaValue result = interpreter.getResult();
      if (result != null) {
        IEclipseValueWrapper wrappedValue = (IEclipseValueWrapper) result;
        Value value = wrappedValue.getWrappedValue();
        if (value instanceof VoidValue) {
          throw new IllegalArgumentException(
              "Evaluation did not return a value. " + compilationErrors.toString());
        }

        return value;
      }

      throw new IllegalArgumentException("Unknown error evaluating expression.");
    } catch (IllegalArgumentException ex) {
      // Expected error from the compiler if the expression is bad, rethrow.
      throw ex;
    } catch (Throwable ex) {
      // We need to actually catch Throwable here, not just Exception until the Eclipse
      // library is fully patched up. There are runtime Errors we might hit.
      Utils.logVerboseException("LIBRARY THROWN:", ex);
      throw new Exception("Internal error parsing expression.");
    }
  }

  // Parses the specified source into a compilation unit with type bindings.
  private CompilationUnit compileSource(
      String source, String sourceFilePath, String unitName, StringBuilder errors)
      throws Exception {

    if (!unitName.endsWith(".java")) {
      // The AST compiler is surprisingly insistent about this.
      unitName += ".java";
    }

    final File sourceFile = new File(sourceFilePath);
    final String directoryPath = sourceFile.getAbsoluteFile().getParent();
    Utils.logVerbose("compiling source for: " + directoryPath);
    final String[] sources = _contextManager.getSourceLocator().getSourceSearchPaths();
    final String[] classpath = _contextManager.getSourceLocator().getBinaryJarPaths();

    final ASTParser parser = ASTParser.newParser(AST.JLS8);
    final Map<String, String> options = JavaCore.getOptions();

    JavaCore.setComplianceOptions(JavaCore.VERSION_1_8, options);
    parser.setCompilerOptions(options);
    parser.setUnitName(unitName);
    parser.setResolveBindings(true);
    parser.setStatementsRecovery(true);
    parser.setBindingsRecovery(true);
    parser.setEnvironment(classpath, sources, null, true);
    parser.setSource(source.toCharArray());

    CompilationUnit unit = (CompilationUnit) parser.createAST(null);
    String errorMsg = checkUnitForProblems(unit);
    if (errorMsg != null) {
      errors.append(errorMsg);
    }

    return unit;
  }

  // Checks a compilation unit for problems, and ignores problems we can get away with ignoring
  // for the purposes of the evaluation.
  private String checkUnitForProblems(CompilationUnit unit) {
    final IProblem[] problems = unit.getProblems();
    final StringBuilder errors = new StringBuilder();
    int realProblemCount = 0;

    if (problems.length > 0) {
      for (IProblem problem : problems) {
        if (!problem.isError()) {
          // Ignore anything that's not error severity.
          continue;
        }

        int problemId = problem.getID();

        // These problems do not need to stop the parse.
        // NOTE: List taken from Eclipse reference impl.
        if (problemId == IProblem.VoidMethodReturnsValue
            || problemId == IProblem.NotVisibleMethod
            || problemId == IProblem.NotVisibleConstructor
            || problemId == IProblem.NotVisibleField
            || problemId == IProblem.NotVisibleType
            || problemId == IProblem.ImportNotFound
            || problemId == IProblem.UndefinedType
            || problemId == IProblem.BodyForAbstractMethod) {

          continue;
        }

        realProblemCount++;
        if (realProblemCount == 1) {
          errors.append("Unable to evaluate expression: ");
        }

        errors.append(problem.getMessage());
        errors.append("\n");
      }

      // We couldn't parse the specified expression.
      // Throw the error messages back to the debugger frontend.
      if (realProblemCount > 0) {
        return errors.toString().trim();
      }
    }

    return null;
  }

  // Gets the current JVM stack frame wrapped as an Eclipse IJavaStackFrame.
  private IJavaStackFrame getStackFrameProxy(StackFrame frame) {
    return new EclipseJavaStackFrameShim(frame, _contextManager);
  }

  private StackFrame getStackFrame(String frameId) {
    try {
      ThreadReference thread = _contextManager.getCurrentThread();
      for (StackFrame frame : thread.frames()) {
        if (Utils.getFrameName(frame).equals(frameId)) {
          return frame;
        }
      }
    } catch (IncompatibleThreadStateException ex) {
      // Fall through.
    }

    return null;
  }

  // Attempts to evaluate the current expression as the name of a local variable in
  // the current call frame.
  private Value evaluateExpressionAsLocal(StackFrame frame, String expression) {
    Value value = null;
    boolean foundMatch = false;

    try {
      LocalVariable variable = frame.visibleVariableByName(expression);
      if (variable != null) {
        value = frame.getValue(variable);
        foundMatch = true;
      }
    } catch (AbsentInformationException e) {
    }

    // If the expression did not match a local variable, what about a field member of the this
    // object at the current call site?
    if (value == null) {
      ObjectReference thisObj = frame.thisObject();
      if (thisObj != null) {
        Map<Field, Value> fieldValueMap = thisObj.getValues(thisObj.referenceType().allFields());
        for (Field field : fieldValueMap.keySet()) {
          if (field.name().equals(expression)) {
            value = fieldValueMap.get(field);
            foundMatch = true;
            break;
          }
        }
      }
    }

    if (foundMatch) {
      return value;
    }

    throw new IllegalArgumentException("Expression does not match any variable");
  }

  // Attempts to evaluate a very simple expression as reaching into a chain
  // of members starting with either "this" or the name of a local in the
  // current stack frame. Returns null on failure.
  private Value evaluateExpressionAsPropertyChain(StackFrame frame, String expression) {
    // This only works for very simple expressions, but worth a shot.
    String[] parts = expression.split("\\.");

    // Any expression that was only the name of a local variable has already
    // been handled before this is called.
    if (parts.length < 2) {
      return null;
    }

    // Validate that the entire expression contains only valid identifiers.
    if (Arrays.stream(parts)
        .anyMatch(part -> !part.equals("this") && !SourceVersion.isName(part))) {
      return null;
    }

    Value currentRef = null;

    // Find the ObjectReference to start walking from. It will either be "this"
    // or a LocalVariable in the current call frame.
    if (parts[0].equals("this")) {
      currentRef = frame.thisObject();
    } else {
      try {
        LocalVariable var = frame.visibleVariableByName(parts[0]);
        if (var != null) {
          currentRef = frame.getValue(var);
        }
      } catch (AbsentInformationException e) {
      }
    }

    int i = 1;
    while (i < parts.length && currentRef instanceof ObjectReference) {
      ObjectReference currentObj = (ObjectReference) currentRef;
      ReferenceType type = currentObj.referenceType();
      Field field = type.fieldByName(parts[i]);
      if (field == null) {
        return null;
      }

      currentRef = currentObj.getValue(field);
      i++;
    }

    return currentRef;
  }
}
