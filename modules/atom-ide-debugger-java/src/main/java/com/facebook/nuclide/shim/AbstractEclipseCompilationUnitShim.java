/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import org.eclipse.core.resources.IMarker;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.jobs.ISchedulingRule;
import org.eclipse.jdt.core.CompletionRequestor;
import org.eclipse.jdt.core.IBuffer;
import org.eclipse.jdt.core.IBufferFactory;
import org.eclipse.jdt.core.ICodeCompletionRequestor;
import org.eclipse.jdt.core.ICompilationUnit;
import org.eclipse.jdt.core.ICompletionRequestor;
import org.eclipse.jdt.core.IImportContainer;
import org.eclipse.jdt.core.IImportDeclaration;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaModel;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IOpenable;
import org.eclipse.jdt.core.IPackageDeclaration;
import org.eclipse.jdt.core.IProblemRequestor;
import org.eclipse.jdt.core.ISourceRange;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.WorkingCopyOwner;
import org.eclipse.jdt.core.dom.CompilationUnit;
import org.eclipse.text.edits.TextEdit;
import org.eclipse.text.edits.UndoEdit;

public abstract class AbstractEclipseCompilationUnitShim
    extends AbstractEclipseShim<ICompilationUnit> implements ICompilationUnit {

  @Override
  public void rename(String string, boolean bln, IProgressMonitor ipm) throws JavaModelException {
    getProxy().rename(string, bln, ipm);
  }

  @Override
  public void move(
      IJavaElement ije, IJavaElement ije1, String string, boolean bln, IProgressMonitor ipm)
      throws JavaModelException {
    getProxy().move(ije, ije1, string, bln, ipm);
  }

  @Override
  public void delete(boolean bln, IProgressMonitor ipm) throws JavaModelException {
    getProxy().delete(bln, ipm);
  }

  @Override
  public void copy(
      IJavaElement ije, IJavaElement ije1, String string, boolean bln, IProgressMonitor ipm)
      throws JavaModelException {
    getProxy().copy(ije, ije1, string, bln, ipm);
  }

  @Override
  public void reconcile(boolean bln, IProgressMonitor ipm) throws JavaModelException {
    getProxy().reconcile(bln, ipm);
  }

  @Override
  public IMarker[] reconcile() throws JavaModelException {
    return getProxy().reconcile();
  }

  @Override
  public boolean isBasedOn(IResource ir) {
    return getProxy().isBasedOn(ir);
  }

  @Override
  public IJavaElement getWorkingCopy(
      IProgressMonitor ipm, IBufferFactory ibf, IProblemRequestor ipr) throws JavaModelException {
    return getProxy().getWorkingCopy(ipm, ibf, ipr);
  }

  @Override
  public IJavaElement getWorkingCopy() throws JavaModelException {
    return getProxy().getWorkingCopy();
  }

  @Override
  public IJavaElement getSharedWorkingCopy(
      IProgressMonitor ipm, IBufferFactory ibf, IProblemRequestor ipr) throws JavaModelException {
    return getProxy().getSharedWorkingCopy(ipm, ibf, ipr);
  }

  @Override
  public IJavaElement getOriginalElement() {
    return getProxy().getOriginalElement();
  }

  @Override
  public IJavaElement getOriginal(IJavaElement ije) {
    return getProxy().getOriginal(ije);
  }

  @Override
  public IJavaElement findSharedWorkingCopy(IBufferFactory ibf) {
    return getProxy().findSharedWorkingCopy(ibf);
  }

  @Override
  public void destroy() {
    getProxy().destroy();
  }

  @Override
  public void commit(boolean bln, IProgressMonitor ipm) throws JavaModelException {
    getProxy().commit(bln, ipm);
  }

  @Override
  public IJavaElement[] codeSelect(int i, int i1, WorkingCopyOwner wco) throws JavaModelException {
    return getProxy().codeSelect(i, i1, wco);
  }

  @Override
  public IJavaElement[] codeSelect(int i, int i1) throws JavaModelException {
    return getProxy().codeSelect(i, i1);
  }

  @Override
  public void codeComplete(
      int i, CompletionRequestor cr, WorkingCopyOwner wco, IProgressMonitor ipm)
      throws JavaModelException {
    getProxy().codeComplete(i, cr, wco, ipm);
  }

  @Override
  public void codeComplete(int i, CompletionRequestor cr, WorkingCopyOwner wco)
      throws JavaModelException {
    getProxy().codeComplete(i, cr, wco);
  }

  @Override
  public void codeComplete(int i, ICompletionRequestor icr, WorkingCopyOwner wco)
      throws JavaModelException {
    getProxy().codeComplete(i, icr, wco);
  }

  @Override
  public void codeComplete(int i, CompletionRequestor cr, IProgressMonitor ipm)
      throws JavaModelException {
    getProxy().codeComplete(i, cr, ipm);
  }

  @Override
  public void codeComplete(int i, CompletionRequestor cr) throws JavaModelException {
    getProxy().codeComplete(i, cr);
  }

  @Override
  public void codeComplete(int i, ICompletionRequestor icr) throws JavaModelException {
    getProxy().codeComplete(i, icr);
  }

  @Override
  public void codeComplete(int i, ICodeCompletionRequestor iccr) throws JavaModelException {
    getProxy().codeComplete(i, iccr);
  }

  @Override
  public ISourceRange getNameRange() throws JavaModelException {
    return getProxy().getNameRange();
  }

  @Override
  public ISourceRange getSourceRange() throws JavaModelException {
    return getProxy().getSourceRange();
  }

  @Override
  public String getSource() throws JavaModelException {
    return getProxy().getSource();
  }

  @Override
  public void save(IProgressMonitor ipm, boolean bln) throws JavaModelException {
    getProxy().save(ipm, bln);
  }

  @Override
  public void open(IProgressMonitor ipm) throws JavaModelException {
    getProxy().open(ipm);
  }

  @Override
  public void makeConsistent(IProgressMonitor ipm) throws JavaModelException {
    getProxy().makeConsistent(ipm);
  }

  @Override
  public boolean isOpen() {
    return getProxy().isOpen();
  }

  @Override
  public boolean isConsistent() throws JavaModelException {
    return getProxy().isConsistent();
  }

  @Override
  public boolean hasUnsavedChanges() throws JavaModelException {
    return getProxy().hasUnsavedChanges();
  }

  @Override
  public IBuffer getBuffer() throws JavaModelException {
    return getProxy().getBuffer();
  }

  @Override
  public String findRecommendedLineSeparator() throws JavaModelException {
    return getProxy().findRecommendedLineSeparator();
  }

  @Override
  public void close() throws JavaModelException {
    getProxy().close();
  }

  @Override
  public boolean hasChildren() throws JavaModelException {
    return getProxy().hasChildren();
  }

  @Override
  public IJavaElement[] getChildren() throws JavaModelException {
    return getProxy().getChildren();
  }

  @Override
  public <T> T getAdapter(Class<T> type) {
    return getProxy().getAdapter(type);
  }

  @Override
  public boolean isStructureKnown() throws JavaModelException {
    return getProxy().isStructureKnown();
  }

  @Override
  public boolean isReadOnly() {
    return getProxy().isReadOnly();
  }

  @Override
  public IResource getUnderlyingResource() throws JavaModelException {
    return getProxy().getUnderlyingResource();
  }

  @Override
  public ISchedulingRule getSchedulingRule() {
    return getProxy().getSchedulingRule();
  }

  @Override
  public IResource getResource() {
    return getProxy().getResource();
  }

  @Override
  public IJavaElement getPrimaryElement() {
    return getProxy().getPrimaryElement();
  }

  @Override
  public IPath getPath() {
    return getProxy().getPath();
  }

  @Override
  public IJavaElement getParent() {
    return getProxy().getParent();
  }

  @Override
  public IOpenable getOpenable() {
    return getProxy().getOpenable();
  }

  @Override
  public IJavaProject getJavaProject() {
    return getProxy().getJavaProject();
  }

  @Override
  public IJavaModel getJavaModel() {
    return getProxy().getJavaModel();
  }

  @Override
  public String getHandleIdentifier() {
    return getProxy().getHandleIdentifier();
  }

  @Override
  public int getElementType() {
    return getProxy().getElementType();
  }

  @Override
  public String getElementName() {
    return getProxy().getElementName();
  }

  @Override
  public IResource getCorrespondingResource() throws JavaModelException {
    return getProxy().getCorrespondingResource();
  }

  @Override
  public String getAttachedJavadoc(IProgressMonitor ipm) throws JavaModelException {
    return getProxy().getAttachedJavadoc(ipm);
  }

  @Override
  public IJavaElement getAncestor(int i) {
    return getProxy().getAncestor(i);
  }

  @Override
  public boolean exists() {
    return getProxy().exists();
  }

  @Override
  public ICompilationUnit getWorkingCopy(WorkingCopyOwner wco, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().getWorkingCopy(wco, ipm);
  }

  @Override
  public IJavaElement getElementAt(int i) throws JavaModelException {
    return getProxy().getElementAt(i);
  }

  @Override
  public IType findPrimaryType() {
    return getProxy().findPrimaryType();
  }

  @Override
  public void restore() throws JavaModelException {
    getProxy().restore();
  }

  @Override
  public CompilationUnit reconcile(int i, int i1, WorkingCopyOwner wco, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().reconcile(i, i1, wco, ipm);
  }

  @Override
  public CompilationUnit reconcile(
      int i, boolean bln, boolean bln1, WorkingCopyOwner wco, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().reconcile(i, bln, bln1, wco, ipm);
  }

  @Override
  public CompilationUnit reconcile(int i, boolean bln, WorkingCopyOwner wco, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().reconcile(i, bln, wco, ipm);
  }

  @Override
  public boolean isWorkingCopy() {
    return getProxy().isWorkingCopy();
  }

  @Override
  public boolean hasResourceChanged() {
    return getProxy().hasResourceChanged();
  }

  @Override
  public ICompilationUnit getWorkingCopy(
      WorkingCopyOwner wco, IProblemRequestor ipr, IProgressMonitor ipm) throws JavaModelException {
    return getProxy().getWorkingCopy(wco, ipr, ipm);
  }

  @Override
  public ICompilationUnit getWorkingCopy(IProgressMonitor ipm) throws JavaModelException {
    return getProxy().getWorkingCopy(ipm);
  }

  @Override
  public IType[] getTypes() throws JavaModelException {
    return getProxy().getTypes();
  }

  @Override
  public IType getType(String string) {
    return getProxy().getType(string);
  }

  @Override
  public IPackageDeclaration[] getPackageDeclarations() throws JavaModelException {
    return getProxy().getPackageDeclarations();
  }

  @Override
  public IPackageDeclaration getPackageDeclaration(String string) {
    return getProxy().getPackageDeclaration(string);
  }

  @Override
  public WorkingCopyOwner getOwner() {
    return getProxy().getOwner();
  }

  @Override
  public ICompilationUnit getPrimary() {
    return getProxy().getPrimary();
  }

  @Override
  public IImportDeclaration[] getImports() throws JavaModelException {
    return getProxy().getImports();
  }

  @Override
  public IImportContainer getImportContainer() {
    return getProxy().getImportContainer();
  }

  @Override
  public IImportDeclaration getImport(String string) {
    return getProxy().getImport(string);
  }

  @Override
  public IType[] getAllTypes() throws JavaModelException {
    return getProxy().getAllTypes();
  }

  @Override
  public ICompilationUnit findWorkingCopy(WorkingCopyOwner wco) {
    return getProxy().findWorkingCopy(wco);
  }

  @Override
  public IJavaElement[] findElements(IJavaElement ije) {
    return getProxy().findElements(ije);
  }

  @Override
  public void discardWorkingCopy() throws JavaModelException {
    getProxy().discardWorkingCopy();
  }

  @Override
  public IType createType(String string, IJavaElement ije, boolean bln, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().createType(string, ije, bln, ipm);
  }

  @Override
  public IPackageDeclaration createPackageDeclaration(String string, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().createPackageDeclaration(string, ipm);
  }

  @Override
  public IImportDeclaration createImport(
      String string, IJavaElement ije, int i, IProgressMonitor ipm) throws JavaModelException {
    return getProxy().createImport(string, ije, i, ipm);
  }

  @Override
  public IImportDeclaration createImport(String string, IJavaElement ije, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().createImport(string, ije, ipm);
  }

  @Override
  public void commitWorkingCopy(boolean bln, IProgressMonitor ipm) throws JavaModelException {
    getProxy().commitWorkingCopy(bln, ipm);
  }

  @Override
  public void becomeWorkingCopy(IProgressMonitor ipm) throws JavaModelException {
    getProxy().becomeWorkingCopy(ipm);
  }

  @Override
  public void becomeWorkingCopy(IProblemRequestor ipr, IProgressMonitor ipm)
      throws JavaModelException {
    getProxy().becomeWorkingCopy(ipr, ipm);
  }

  @Override
  public UndoEdit applyTextEdit(TextEdit te, IProgressMonitor ipm) throws JavaModelException {
    return getProxy().applyTextEdit(te, ipm);
  }
}
