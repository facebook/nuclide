/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import com.facebook.nuclide.debugger.ContextManager;
import com.sun.jdi.InterfaceType;
import com.sun.jdi.ReferenceType;
import com.sun.jdi.VirtualMachine;
import java.util.List;
import java.util.Map;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.ITypeRoot;
import org.eclipse.jdt.core.JavaCore;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.SourceRange;
import org.eclipse.jdt.core.dom.AST;
import org.eclipse.jdt.core.dom.ASTNode;
import org.eclipse.jdt.core.dom.ASTParser;
import org.eclipse.jdt.core.dom.ASTVisitor;
import org.eclipse.jdt.core.dom.AbstractTypeDeclaration;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.jdt.core.dom.SimpleName;
import org.eclipse.jdt.core.dom.TypeDeclaration;

public class EclipseJavaElementShim extends AbstractEclipseJavaElementShim {
  private final ContextManager _contextManager;
  private final ReferenceType _refType;
  private ISourceRange _sourceRange;

  private static ReferenceType getReferenceType(Object obj) {
    if (obj instanceof IReferenceTypeProxy) {
      return ((IReferenceTypeProxy) obj).getReferenceType();
    }

    return null;
  }

  public EclipseJavaElementShim(Object obj, ContextManager contextManager) {
    this(getReferenceType(obj), contextManager);
  }

  public EclipseJavaElementShim(ReferenceType refType, ContextManager contextManager) {
    _contextManager = contextManager;
    _refType = refType;
    _sourceRange = null;
  }

  @Override
  public boolean exists() {
    return true;
  }

  private static SimpleName getNodeDeclName(ASTNode node) {
    try {
      AbstractTypeDeclaration decl = (AbstractTypeDeclaration) node;
      return decl.getName();
    } catch (Exception ex) {
      return null;
    }
  }

  private static String fixTargetName(String targetName) {
    // Target Name is fully qualified but the AST below is going to
    // give us a SimpleName. Try to pull out the identifier only.
    targetName = targetName.substring(targetName.lastIndexOf(".") + 1);

    // If this is an inner class, grab the inner class name.
    int inner = targetName.lastIndexOf("$");
    if (inner < 0) {
      return targetName;
    }

    targetName = targetName.substring(inner + 1);
    return targetName;
  }

  @Override
  public boolean isInterface() throws JavaModelException {
    return (_refType instanceof InterfaceType);
  }

  @Override
  public ICompilationUnit getCompilationUnit() {
    return new EclipseCompilationUnitShim(_refType, _contextManager);
  }

  @Override
  public boolean isBinary() {
    return false;
  }

  @Override
  public ITypeRoot getTypeRoot() {
    return null;
  }

  // Request for information about the source character range in which this
  // type is declared in the source file backing the compilation unit that
  // declares the type.
  @Override
  public ISourceRange getNameRange() throws JavaModelException {
    if (_sourceRange != null) {
      return _sourceRange;
    }

    // We need to determine the location in the source at which this type
    // is declared. Compute an AST from the source file, and fine the declaring
    // node.
    ICompilationUnit unit = getCompilationUnit();
    ASTParser parser = ASTParser.newParser(AST.JLS8);
    Map<String, String> options = JavaCore.getOptions();
    JavaCore.setComplianceOptions(JavaCore.VERSION_1_8, options);
    parser.setCompilerOptions(options);

    try {
      parser.setSource(unit.getSource().toCharArray());
    } catch (Exception ex) {
      return new SourceRange(0, 0);
    }

    final String targetName = fixTargetName(_refType.name());
    CompilationUnit ast = (CompilationUnit) parser.createAST(null);
    ast.accept(
        new ASTVisitor(false) {
          public boolean visit(TypeDeclaration node) {
            SimpleName name = getNodeDeclName(node);
            if (name.getFullyQualifiedName().equals(targetName)) {
              _sourceRange = new SourceRange(name.getStartPosition(), name.getLength());

              // No need to continue processing, we've found what we're looking for.
              return false;
            }
            return true;
          }
        });

    if (_sourceRange != null) {
      return _sourceRange;
    }

    // Can't return null or the source generator will die.
    return new SourceRange(0, 1);
  }

  // This is a query for a nested type declared within the type
  // of the wrapped object.
  @Override
  public IType getType(String name, int occurrenceCount) {
    if (_refType == null) {
      return null;
    }

    List<ReferenceType> nestedTypes = _refType.nestedTypes();
    for (ReferenceType refType : nestedTypes) {
      String nestedTypeName = refType.name();
      if (nestedTypeName.equals(name)) {
        return new EclipseJavaElementShim(refType, _contextManager);
      }
    }

    // Didn't find it, fall back to checking with the VM class loaders.
    VirtualMachine vm = _contextManager.getVirtualMachine();
    String baseName = _refType.name();
    if (baseName.lastIndexOf("$") > 0) {
      baseName = baseName.substring(0, baseName.lastIndexOf("$"));
    }

    String fullyQualifiedName = _refType.name() + "$" + name;
    List<ReferenceType> refs = vm.classesByName(fullyQualifiedName);
    for (ReferenceType refType : refs) {
      String nestedTypeName = refType.name();
      if (nestedTypeName.equals(name)) {
        return new EclipseJavaElementShim(refType, _contextManager);
      }
    }

    return null;
  }

  @Override
  public IType getType(String name) {
    return getType(name, 0);
  }
}
