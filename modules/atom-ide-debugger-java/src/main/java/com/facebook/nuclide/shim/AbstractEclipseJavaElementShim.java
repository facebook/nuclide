/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import java.io.InputStream;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.jobs.ISchedulingRule;
import org.eclipse.jdt.core.*;

public abstract class AbstractEclipseJavaElementShim extends AbstractEclipseShim<IType>
    implements IType {

  @Override
  public IAnnotation getAnnotation(String name) {
    return getProxy().getAnnotation(name);
  }

  @Override
  public IJavaElement[] getChildren() throws JavaModelException {
    return getProxy().getChildren();
  }

  @Override
  public IAnnotation[] getAnnotations() throws JavaModelException {
    return getProxy().getAnnotations();
  }

  @Override
  public String[] getCategories() throws JavaModelException {
    return getProxy().getCategories();
  }

  @Override
  public boolean hasChildren() throws JavaModelException {
    return getProxy().hasChildren();
  }

  @Override
  public IClassFile getClassFile() {
    return getProxy().getClassFile();
  }

  @Override
  public String getSource() throws JavaModelException {
    return getProxy().getSource();
  }

  @Override
  public void copy(
      IJavaElement container,
      IJavaElement sibling,
      String rename,
      boolean replace,
      IProgressMonitor monitor)
      throws JavaModelException {
    getProxy().copy(container, sibling, rename, replace, monitor);
  }

  @Override
  public ICompilationUnit getCompilationUnit() {
    return getProxy().getCompilationUnit();
  }

  @Override
  public IType getDeclaringType() {
    return getProxy().getDeclaringType();
  }

  @Override
  public void codeComplete(
      char[] snippet,
      int insertion,
      int position,
      char[][] localVariableTypeNames,
      char[][] localVariableNames,
      int[] localVariableModifiers,
      boolean isStatic,
      CompletionRequestor requestor,
      IProgressMonitor monitor)
      throws JavaModelException {
    getProxy()
        .codeComplete(
            snippet,
            insertion,
            position,
            localVariableTypeNames,
            localVariableNames,
            localVariableModifiers,
            isStatic,
            requestor,
            monitor);
  }

  @Override
  public void codeComplete(
      char[] snippet,
      int insertion,
      int position,
      char[][] localVariableTypeNames,
      char[][] localVariableNames,
      int[] localVariableModifiers,
      boolean isStatic,
      ICompletionRequestor requestor)
      throws JavaModelException {
    getProxy()
        .codeComplete(
            snippet,
            insertion,
            position,
            localVariableTypeNames,
            localVariableNames,
            localVariableModifiers,
            isStatic,
            requestor);
  }

  @Override
  public ISourceRange getSourceRange() throws JavaModelException {
    return getProxy().getSourceRange();
  }

  @Override
  public void delete(boolean force, IProgressMonitor monitor) throws JavaModelException {
    getProxy().delete(force, monitor);
  }

  @Override
  public int getFlags() throws JavaModelException {
    return getProxy().getFlags();
  }

  @Override
  public ISourceRange getJavadocRange() throws JavaModelException {
    return getProxy().getJavadocRange();
  }

  @Override
  public void move(
      IJavaElement container,
      IJavaElement sibling,
      String rename,
      boolean replace,
      IProgressMonitor monitor)
      throws JavaModelException {
    getProxy().move(container, sibling, rename, replace, monitor);
  }

  @Override
  protected IType getProxy() {
    return super.getProxy();
  }

  @Override
  public ISourceRange getNameRange() throws JavaModelException {
    return getProxy().getNameRange();
  }

  @Override
  public void codeComplete(
      char[] snippet,
      int insertion,
      int position,
      char[][] localVariableTypeNames,
      char[][] localVariableNames,
      int[] localVariableModifiers,
      boolean isStatic,
      ICompletionRequestor requestor,
      WorkingCopyOwner owner)
      throws JavaModelException {
    getProxy()
        .codeComplete(
            snippet,
            insertion,
            position,
            localVariableTypeNames,
            localVariableNames,
            localVariableModifiers,
            isStatic,
            requestor,
            owner);
  }

  @Override
  public boolean exists() {
    return getProxy().exists();
  }

  @Override
  public void rename(String name, boolean replace, IProgressMonitor monitor)
      throws JavaModelException {
    getProxy().rename(name, replace, monitor);
  }

  @Override
  public int getOccurrenceCount() {
    return getProxy().getOccurrenceCount();
  }

  @Override
  public IJavaElement getAncestor(int ancestorType) {
    return getProxy().getAncestor(ancestorType);
  }

  @Override
  public ITypeRoot getTypeRoot() {
    return getProxy().getTypeRoot();
  }

  @Override
  public IType getType(String name, int occurrenceCount) {
    return getProxy().getType(name, occurrenceCount);
  }

  @Override
  public void codeComplete(
      char[] snippet,
      int insertion,
      int position,
      char[][] localVariableTypeNames,
      char[][] localVariableNames,
      int[] localVariableModifiers,
      boolean isStatic,
      CompletionRequestor requestor)
      throws JavaModelException {
    getProxy()
        .codeComplete(
            snippet,
            insertion,
            position,
            localVariableTypeNames,
            localVariableNames,
            localVariableModifiers,
            isStatic,
            requestor);
  }

  @Override
  public boolean isBinary() {
    return getProxy().isBinary();
  }

  @Override
  public String getAttachedJavadoc(IProgressMonitor monitor) throws JavaModelException {
    return getProxy().getAttachedJavadoc(monitor);
  }

  @Override
  public IResource getCorrespondingResource() throws JavaModelException {
    return getProxy().getCorrespondingResource();
  }

  @Override
  public int getElementType() {
    return getProxy().getElementType();
  }

  @Override
  public String getHandleIdentifier() {
    return getProxy().getHandleIdentifier();
  }

  @Override
  public IJavaModel getJavaModel() {
    return getProxy().getJavaModel();
  }

  @Override
  public IJavaProject getJavaProject() {
    return getProxy().getJavaProject();
  }

  @Override
  public IOpenable getOpenable() {
    return getProxy().getOpenable();
  }

  @Override
  public IJavaElement getParent() {
    return getProxy().getParent();
  }

  @Override
  public IPath getPath() {
    return getProxy().getPath();
  }

  @Override
  public void codeComplete(
      char[] snippet,
      int insertion,
      int position,
      char[][] localVariableTypeNames,
      char[][] localVariableNames,
      int[] localVariableModifiers,
      boolean isStatic,
      CompletionRequestor requestor,
      WorkingCopyOwner owner)
      throws JavaModelException {
    getProxy()
        .codeComplete(
            snippet,
            insertion,
            position,
            localVariableTypeNames,
            localVariableNames,
            localVariableModifiers,
            isStatic,
            requestor,
            owner);
  }

  @Override
  public IJavaElement getPrimaryElement() {
    return getProxy().getPrimaryElement();
  }

  @Override
  public IResource getResource() {
    return getProxy().getResource();
  }

  @Override
  public ISchedulingRule getSchedulingRule() {
    return getProxy().getSchedulingRule();
  }

  @Override
  public IResource getUnderlyingResource() throws JavaModelException {
    return getProxy().getUnderlyingResource();
  }

  @Override
  public boolean isReadOnly() {
    return getProxy().isReadOnly();
  }

  @Override
  public boolean isStructureKnown() throws JavaModelException {
    return getProxy().isStructureKnown();
  }

  @Override
  public void codeComplete(
      char[] snippet,
      int insertion,
      int position,
      char[][] localVariableTypeNames,
      char[][] localVariableNames,
      int[] localVariableModifiers,
      boolean isStatic,
      CompletionRequestor requestor,
      WorkingCopyOwner owner,
      IProgressMonitor monitor)
      throws JavaModelException {
    getProxy()
        .codeComplete(
            snippet,
            insertion,
            position,
            localVariableTypeNames,
            localVariableNames,
            localVariableModifiers,
            isStatic,
            requestor,
            owner,
            monitor);
  }

  @Override
  public IField createField(
      String contents, IJavaElement sibling, boolean force, IProgressMonitor monitor)
      throws JavaModelException {
    return getProxy().createField(contents, sibling, force, monitor);
  }

  @Override
  public IInitializer createInitializer(
      String contents, IJavaElement sibling, IProgressMonitor monitor) throws JavaModelException {
    return getProxy().createInitializer(contents, sibling, monitor);
  }

  @Override
  public IMethod createMethod(
      String contents, IJavaElement sibling, boolean force, IProgressMonitor monitor)
      throws JavaModelException {
    return getProxy().createMethod(contents, sibling, force, monitor);
  }

  @Override
  public IType createType(
      String contents, IJavaElement sibling, boolean force, IProgressMonitor monitor)
      throws JavaModelException {
    return getProxy().createType(contents, sibling, force, monitor);
  }

  @Override
  public IMethod[] findMethods(IMethod method) {
    return getProxy().findMethods(method);
  }

  @Override
  public IJavaElement[] getChildrenForCategory(String category) throws JavaModelException {
    return getProxy().getChildrenForCategory(category);
  }

  @Override
  public String getElementName() {
    return getProxy().getElementName();
  }

  @Override
  public IField getField(String name) {
    return getProxy().getField(name);
  }

  @Override
  public IField[] getFields() throws JavaModelException {
    return getProxy().getFields();
  }

  @Override
  public String getFullyQualifiedName() {
    return getProxy().getFullyQualifiedName();
  }

  @Override
  public String getFullyQualifiedName(char enclosingTypeSeparator) {
    return getProxy().getFullyQualifiedName(enclosingTypeSeparator);
  }

  @Override
  public String getFullyQualifiedParameterizedName() throws JavaModelException {
    return getProxy().getFullyQualifiedParameterizedName();
  }

  @Override
  public IInitializer getInitializer(int occurrenceCount) {
    return getProxy().getInitializer(occurrenceCount);
  }

  @Override
  public IInitializer[] getInitializers() throws JavaModelException {
    return getProxy().getInitializers();
  }

  @Override
  public String getKey() {
    return getProxy().getKey();
  }

  @Override
  public IMethod getMethod(String name, String[] parameterTypeSignatures) {
    return getProxy().getMethod(name, parameterTypeSignatures);
  }

  @Override
  public IMethod[] getMethods() throws JavaModelException {
    return getProxy().getMethods();
  }

  @Override
  public IPackageFragment getPackageFragment() {
    return getProxy().getPackageFragment();
  }

  @Override
  public String getSuperclassName() throws JavaModelException {
    return getProxy().getSuperclassName();
  }

  @Override
  public String getSuperclassTypeSignature() throws JavaModelException {
    return getProxy().getSuperclassTypeSignature();
  }

  @Override
  public String[] getSuperInterfaceTypeSignatures() throws JavaModelException {
    return getProxy().getSuperInterfaceTypeSignatures();
  }

  @Override
  public String[] getSuperInterfaceNames() throws JavaModelException {
    return getProxy().getSuperInterfaceNames();
  }

  @Override
  public String[] getTypeParameterSignatures() throws JavaModelException {
    return getProxy().getTypeParameterSignatures();
  }

  @Override
  public ITypeParameter[] getTypeParameters() throws JavaModelException {
    return getProxy().getTypeParameters();
  }

  @Override
  public IType getType(String name) {
    return getProxy().getType(name);
  }

  @Override
  public ITypeParameter getTypeParameter(String name) {
    return getProxy().getTypeParameter(name);
  }

  @Override
  public String getTypeQualifiedName() {
    return getProxy().getTypeQualifiedName();
  }

  @Override
  public String getTypeQualifiedName(char enclosingTypeSeparator) {
    return getProxy().getTypeQualifiedName(enclosingTypeSeparator);
  }

  @Override
  public IType[] getTypes() throws JavaModelException {
    return getProxy().getTypes();
  }

  @Override
  public boolean isAnonymous() throws JavaModelException {
    return getProxy().isAnonymous();
  }

  @Override
  public boolean isClass() throws JavaModelException {
    return getProxy().isClass();
  }

  @Override
  public boolean isEnum() throws JavaModelException {
    return getProxy().isEnum();
  }

  @Override
  public boolean isInterface() throws JavaModelException {
    return getProxy().isInterface();
  }

  @Override
  public boolean isLambda() {
    return getProxy().isLambda();
  }

  @Override
  public boolean isAnnotation() throws JavaModelException {
    return getProxy().isAnnotation();
  }

  @Override
  public boolean isLocal() throws JavaModelException {
    return getProxy().isLocal();
  }

  @Override
  public boolean isMember() throws JavaModelException {
    return getProxy().isMember();
  }

  @Override
  public boolean isResolved() {
    return getProxy().isResolved();
  }

  @Override
  public ITypeHierarchy loadTypeHierachy(InputStream input, IProgressMonitor monitor)
      throws JavaModelException {
    return getProxy().loadTypeHierachy(input, monitor);
  }

  @Override
  public ITypeHierarchy newSupertypeHierarchy(IProgressMonitor monitor) throws JavaModelException {
    return getProxy().newSupertypeHierarchy(monitor);
  }

  @Override
  public ITypeHierarchy newSupertypeHierarchy(
      ICompilationUnit[] workingCopies, IProgressMonitor monitor) throws JavaModelException {
    return getProxy().newSupertypeHierarchy(workingCopies, monitor);
  }

  @Override
  public ITypeHierarchy newSupertypeHierarchy(
      IWorkingCopy[] workingCopies, IProgressMonitor monitor) throws JavaModelException {
    return getProxy().newSupertypeHierarchy(workingCopies, monitor);
  }

  @Override
  public ITypeHierarchy newSupertypeHierarchy(WorkingCopyOwner owner, IProgressMonitor monitor)
      throws JavaModelException {
    return getProxy().newSupertypeHierarchy(owner, monitor);
  }

  @Override
  public ITypeHierarchy newTypeHierarchy(IJavaProject project, IProgressMonitor monitor)
      throws JavaModelException {
    return getProxy().newTypeHierarchy(project, monitor);
  }

  @Override
  public ITypeHierarchy newTypeHierarchy(
      IJavaProject project, WorkingCopyOwner owner, IProgressMonitor monitor)
      throws JavaModelException {
    return getProxy().newTypeHierarchy(project, owner, monitor);
  }

  @Override
  public ITypeHierarchy newTypeHierarchy(IProgressMonitor monitor) throws JavaModelException {
    return getProxy().newTypeHierarchy(monitor);
  }

  @Override
  public ITypeHierarchy newTypeHierarchy(ICompilationUnit[] workingCopies, IProgressMonitor monitor)
      throws JavaModelException {
    return getProxy().newTypeHierarchy(workingCopies, monitor);
  }

  @Override
  public ITypeHierarchy newTypeHierarchy(IWorkingCopy[] workingCopies, IProgressMonitor monitor)
      throws JavaModelException {
    return getProxy().newTypeHierarchy(workingCopies, monitor);
  }

  @Override
  public ITypeHierarchy newTypeHierarchy(WorkingCopyOwner owner, IProgressMonitor monitor)
      throws JavaModelException {
    return getProxy().newTypeHierarchy(owner, monitor);
  }

  @Override
  public String[][] resolveType(String typeName) throws JavaModelException {
    return getProxy().resolveType(typeName);
  }

  @Override
  public String[][] resolveType(String typeName, WorkingCopyOwner owner) throws JavaModelException {
    return getProxy().resolveType(typeName, owner);
  }

  @Override
  public <T> T getAdapter(Class<T> adapter) {
    return getProxy().getAdapter(adapter);
  }
}
