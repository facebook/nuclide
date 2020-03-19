/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import java.util.Map;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.jobs.ISchedulingRule;
import org.eclipse.jdt.core.IBuffer;
import org.eclipse.jdt.core.IClasspathEntry;
import org.eclipse.jdt.core.IJavaElement;
import org.eclipse.jdt.core.IJavaModel;
import org.eclipse.jdt.core.IJavaProject;
import org.eclipse.jdt.core.IOpenable;
import org.eclipse.jdt.core.IPackageFragment;
import org.eclipse.jdt.core.IPackageFragmentRoot;
import org.eclipse.jdt.core.IRegion;
import org.eclipse.jdt.core.IType;
import org.eclipse.jdt.core.ITypeHierarchy;
import org.eclipse.jdt.core.JavaModelException;
import org.eclipse.jdt.core.WorkingCopyOwner;
import org.eclipse.jdt.core.eval.IEvaluationContext;

public abstract class AbstractEclipseJavaProjectShim extends AbstractEclipseShim<IJavaProject>
    implements IJavaProject {

  @Override
  public IClasspathEntry decodeClasspathEntry(String string) {
    return getProxy().decodeClasspathEntry(string);
  }

  @Override
  public String encodeClasspathEntry(IClasspathEntry ice) {
    return getProxy().encodeClasspathEntry(ice);
  }

  @Override
  public IJavaElement findElement(IPath ipath) throws JavaModelException {
    return getProxy().findElement(ipath);
  }

  @Override
  public IJavaElement findElement(IPath ipath, WorkingCopyOwner wco) throws JavaModelException {
    return getProxy().findElement(ipath, wco);
  }

  @Override
  public IJavaElement findElement(String string, WorkingCopyOwner wco) throws JavaModelException {
    return getProxy().findElement(string, wco);
  }

  @Override
  public IPackageFragment findPackageFragment(IPath ipath) throws JavaModelException {
    return getProxy().findPackageFragment(ipath);
  }

  @Override
  public IPackageFragmentRoot findPackageFragmentRoot(IPath ipath) throws JavaModelException {
    return getProxy().findPackageFragmentRoot(ipath);
  }

  @Override
  public IPackageFragmentRoot[] findPackageFragmentRoots(IClasspathEntry ice) {
    return getProxy().findPackageFragmentRoots(ice);
  }

  @Override
  public IType findType(String string) throws JavaModelException {
    return getProxy().findType(string);
  }

  @Override
  public IType findType(String string, IProgressMonitor ipm) throws JavaModelException {
    return getProxy().findType(string, ipm);
  }

  @Override
  public IType findType(String string, WorkingCopyOwner wco) throws JavaModelException {
    return getProxy().findType(string, wco);
  }

  @Override
  public IType findType(String string, WorkingCopyOwner wco, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().findType(string, wco, ipm);
  }

  @Override
  public IType findType(String string, String string1) throws JavaModelException {
    return getProxy().findType(string, string1);
  }

  @Override
  public IType findType(String string, String string1, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().findType(string, string1, ipm);
  }

  @Override
  public IType findType(String string, String string1, WorkingCopyOwner wco)
      throws JavaModelException {
    return getProxy().findType(string, string1, wco);
  }

  @Override
  public IType findType(String string, String string1, WorkingCopyOwner wco, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().findType(string, string1, wco, ipm);
  }

  @Override
  public IPackageFragmentRoot[] getAllPackageFragmentRoots() throws JavaModelException {
    return getProxy().getAllPackageFragmentRoots();
  }

  @Override
  public Object[] getNonJavaResources() throws JavaModelException {
    return getProxy().getNonJavaResources();
  }

  @Override
  public String getOption(String string, boolean bln) {
    return getProxy().getOption(string, bln);
  }

  @Override
  public Map<String, String> getOptions(boolean bln) {
    return getProxy().getOptions(bln);
  }

  @Override
  public IPath getOutputLocation() throws JavaModelException {
    return getProxy().getOutputLocation();
  }

  @Override
  public IPackageFragmentRoot getPackageFragmentRoot(String string) {
    return getProxy().getPackageFragmentRoot(string);
  }

  @Override
  public IPackageFragmentRoot getPackageFragmentRoot(IResource ir) {
    return getProxy().getPackageFragmentRoot(ir);
  }

  @Override
  public IPackageFragmentRoot[] getPackageFragmentRoots() throws JavaModelException {
    return getProxy().getPackageFragmentRoots();
  }

  @Override
  public IPackageFragmentRoot[] getPackageFragmentRoots(IClasspathEntry ice) {
    return getProxy().getPackageFragmentRoots(ice);
  }

  @Override
  public IPackageFragment[] getPackageFragments() throws JavaModelException {
    return getProxy().getPackageFragments();
  }

  @Override
  public IProject getProject() {
    return getProxy().getProject();
  }

  @Override
  public IClasspathEntry[] getRawClasspath() throws JavaModelException {
    return getProxy().getRawClasspath();
  }

  @Override
  public String[] getRequiredProjectNames() throws JavaModelException {
    return getProxy().getRequiredProjectNames();
  }

  @Override
  public IClasspathEntry[] getResolvedClasspath(boolean bln) throws JavaModelException {
    return getProxy().getResolvedClasspath(bln);
  }

  @Override
  public boolean hasBuildState() {
    return getProxy().hasBuildState();
  }

  @Override
  public boolean hasClasspathCycle(IClasspathEntry[] ices) {
    return getProxy().hasClasspathCycle(ices);
  }

  @Override
  public boolean isOnClasspath(IJavaElement ije) {
    return getProxy().isOnClasspath(ije);
  }

  @Override
  public boolean isOnClasspath(IResource ir) {
    return getProxy().isOnClasspath(ir);
  }

  @Override
  public IEvaluationContext newEvaluationContext() {
    return getProxy().newEvaluationContext();
  }

  @Override
  public ITypeHierarchy newTypeHierarchy(IRegion ir, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().newTypeHierarchy(ir, ipm);
  }

  @Override
  public ITypeHierarchy newTypeHierarchy(IRegion ir, WorkingCopyOwner wco, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().newTypeHierarchy(ir, wco, ipm);
  }

  @Override
  public ITypeHierarchy newTypeHierarchy(IType itype, IRegion ir, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().newTypeHierarchy(itype, ir, ipm);
  }

  @Override
  public ITypeHierarchy newTypeHierarchy(
      IType itype, IRegion ir, WorkingCopyOwner wco, IProgressMonitor ipm)
      throws JavaModelException {
    return getProxy().newTypeHierarchy(itype, ir, wco, ipm);
  }

  @Override
  public IPath readOutputLocation() {
    return getProxy().readOutputLocation();
  }

  @Override
  public IClasspathEntry[] readRawClasspath() {
    return getProxy().readRawClasspath();
  }

  @Override
  public void setOption(String string, String string1) {
    getProxy().setOption(string, string1);
  }

  @Override
  public void setOptions(Map<String, String> map) {
    getProxy().setOptions(map);
  }

  @Override
  public void setOutputLocation(IPath ipath, IProgressMonitor ipm) throws JavaModelException {
    getProxy().setOutputLocation(ipath, ipm);
  }

  @Override
  public void setRawClasspath(
      IClasspathEntry[] ices, IPath ipath, boolean bln, IProgressMonitor ipm)
      throws JavaModelException {
    getProxy().setRawClasspath(ices, ipath, bln, ipm);
  }

  @Override
  public void setRawClasspath(IClasspathEntry[] ices, boolean bln, IProgressMonitor ipm)
      throws JavaModelException {
    getProxy().setRawClasspath(ices, bln, ipm);
  }

  @Override
  public void setRawClasspath(
      IClasspathEntry[] ices, IClasspathEntry[] ices1, IPath ipath, IProgressMonitor ipm)
      throws JavaModelException {
    getProxy().setRawClasspath(ices, ices1, ipath, ipm);
  }

  @Override
  public IClasspathEntry[] getReferencedClasspathEntries() throws JavaModelException {
    return getProxy().getReferencedClasspathEntries();
  }

  @Override
  public void setRawClasspath(IClasspathEntry[] ices, IProgressMonitor ipm)
      throws JavaModelException {
    getProxy().setRawClasspath(ices, ipm);
  }

  @Override
  public void setRawClasspath(IClasspathEntry[] ices, IPath ipath, IProgressMonitor ipm)
      throws JavaModelException {
    getProxy().setRawClasspath(ices, ipath, ipm);
  }

  @Override
  public IJavaElement[] getChildren() throws JavaModelException {
    return getProxy().getChildren();
  }

  @Override
  public boolean hasChildren() throws JavaModelException {
    return getProxy().hasChildren();
  }

  @Override
  public boolean exists() {
    return getProxy().exists();
  }

  @Override
  public IJavaElement getAncestor(int i) {
    return getProxy().getAncestor(i);
  }

  @Override
  public String getAttachedJavadoc(IProgressMonitor ipm) throws JavaModelException {
    return getProxy().getAttachedJavadoc(ipm);
  }

  @Override
  public IResource getCorrespondingResource() throws JavaModelException {
    return getProxy().getCorrespondingResource();
  }

  @Override
  public String getElementName() {
    return getProxy().getElementName();
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
  public <T> T getAdapter(Class<T> type) {
    return getProxy().getAdapter(type);
  }

  @Override
  public void close() throws JavaModelException {
    getProxy().close();
  }

  @Override
  public String findRecommendedLineSeparator() throws JavaModelException {
    return getProxy().findRecommendedLineSeparator();
  }

  @Override
  public IBuffer getBuffer() throws JavaModelException {
    return getProxy().getBuffer();
  }

  @Override
  public boolean hasUnsavedChanges() throws JavaModelException {
    return getProxy().hasUnsavedChanges();
  }

  @Override
  public boolean isConsistent() throws JavaModelException {
    return getProxy().isConsistent();
  }

  @Override
  public boolean isOpen() {
    return getProxy().isOpen();
  }

  @Override
  public void makeConsistent(IProgressMonitor ipm) throws JavaModelException {
    getProxy().makeConsistent(ipm);
  }

  @Override
  public void open(IProgressMonitor ipm) throws JavaModelException {
    getProxy().open(ipm);
  }

  @Override
  public void save(IProgressMonitor ipm, boolean bln) throws JavaModelException {
    getProxy().save(ipm, bln);
  }
}
