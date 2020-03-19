/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import java.net.URI;
import java.util.Map;
import org.eclipse.core.resources.FileInfoMatcherDescription;
import org.eclipse.core.resources.IBuildConfiguration;
import org.eclipse.core.resources.IContainer;
import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.IFolder;
import org.eclipse.core.resources.IMarker;
import org.eclipse.core.resources.IPathVariableManager;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IProjectDescription;
import org.eclipse.core.resources.IProjectNature;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.IResourceFilterDescription;
import org.eclipse.core.resources.IResourceProxy;
import org.eclipse.core.resources.IResourceProxyVisitor;
import org.eclipse.core.resources.IResourceVisitor;
import org.eclipse.core.resources.IWorkspace;
import org.eclipse.core.resources.ResourceAttributes;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IPath;
import org.eclipse.core.runtime.IPluginDescriptor;
import org.eclipse.core.runtime.IProgressMonitor;
import org.eclipse.core.runtime.QualifiedName;
import org.eclipse.core.runtime.content.IContentTypeMatcher;
import org.eclipse.core.runtime.jobs.ISchedulingRule;

public abstract class AbstractEclipseEnvironmentShim
    extends AbstractEclipseShim<IEclipseEnvironment> implements IEclipseEnvironment {

  @Override
  public void accept(IResourceProxyVisitor irpv, int i) throws CoreException {
    getProxy().accept(irpv, i);
  }

  @Override
  public void accept(IResourceProxyVisitor irpv, int i, int i1) throws CoreException {
    getProxy().accept(irpv, i, i1);
  }

  @Override
  public void accept(IResourceVisitor irv) throws CoreException {
    getProxy().accept(irv);
  }

  @Override
  public void accept(IResourceVisitor irv, int i, boolean bln) throws CoreException {
    getProxy().accept(irv, i, bln);
  }

  @Override
  public void accept(IResourceVisitor irv, int i, int i1) throws CoreException {
    getProxy().accept(irv, i, i1);
  }

  @Override
  public void clearHistory(IProgressMonitor ipm) throws CoreException {
    getProxy().clearHistory(ipm);
  }

  @Override
  public void copy(IPath ipath, boolean bln, IProgressMonitor ipm) throws CoreException {
    getProxy().copy(ipath, bln, ipm);
  }

  @Override
  public void copy(IPath ipath, int i, IProgressMonitor ipm) throws CoreException {
    getProxy().copy(ipath, i, ipm);
  }

  @Override
  public void copy(IProjectDescription ipd, boolean bln, IProgressMonitor ipm)
      throws CoreException {
    getProxy().copy(ipd, bln, ipm);
  }

  @Override
  public void copy(IProjectDescription ipd, int i, IProgressMonitor ipm) throws CoreException {
    getProxy().copy(ipd, i, ipm);
  }

  @Override
  public IMarker createMarker(String string) throws CoreException {
    return getProxy().createMarker(string);
  }

  @Override
  public IResourceProxy createProxy() {
    return getProxy().createProxy();
  }

  @Override
  public void delete(boolean bln, IProgressMonitor ipm) throws CoreException {
    getProxy().delete(bln, ipm);
  }

  @Override
  public void delete(int i, IProgressMonitor ipm) throws CoreException {
    getProxy().delete(i, ipm);
  }

  @Override
  public void deleteMarkers(String string, boolean bln, int i) throws CoreException {
    getProxy().deleteMarkers(string, bln, i);
  }

  @Override
  public boolean exists() {
    return getProxy().exists();
  }

  @Override
  public IMarker findMarker(long l) throws CoreException {
    return getProxy().findMarker(l);
  }

  @Override
  public IMarker[] findMarkers(String string, boolean bln, int i) throws CoreException {
    return getProxy().findMarkers(string, bln, i);
  }

  @Override
  public int findMaxProblemSeverity(String string, boolean bln, int i) throws CoreException {
    return getProxy().findMaxProblemSeverity(string, bln, i);
  }

  @Override
  public String getFileExtension() {
    return getProxy().getFileExtension();
  }

  @Override
  public IPath getFullPath() {
    return getProxy().getFullPath();
  }

  @Override
  public long getLocalTimeStamp() {
    return getProxy().getLocalTimeStamp();
  }

  @Override
  public IPath getLocation() {
    return getProxy().getLocation();
  }

  @Override
  public URI getLocationURI() {
    return getProxy().getLocationURI();
  }

  @Override
  public IMarker getMarker(long l) {
    return getProxy().getMarker(l);
  }

  @Override
  public long getModificationStamp() {
    return getProxy().getModificationStamp();
  }

  @Override
  public String getName() {
    return getProxy().getName();
  }

  @Override
  public IPathVariableManager getPathVariableManager() {
    return getProxy().getPathVariableManager();
  }

  @Override
  public IContainer getParent() {
    return getProxy().getParent();
  }

  @Override
  public Map<QualifiedName, String> getPersistentProperties() throws CoreException {
    return getProxy().getPersistentProperties();
  }

  @Override
  public String getPersistentProperty(QualifiedName qn) throws CoreException {
    return getProxy().getPersistentProperty(qn);
  }

  @Override
  public IProject getProject() {
    return getProxy().getProject();
  }

  @Override
  public IPath getProjectRelativePath() {
    return getProxy().getProjectRelativePath();
  }

  @Override
  public IPath getRawLocation() {
    return getProxy().getRawLocation();
  }

  @Override
  public URI getRawLocationURI() {
    return getProxy().getRawLocationURI();
  }

  @Override
  public ResourceAttributes getResourceAttributes() {
    return getProxy().getResourceAttributes();
  }

  @Override
  public Map<QualifiedName, Object> getSessionProperties() throws CoreException {
    return getProxy().getSessionProperties();
  }

  @Override
  public Object getSessionProperty(QualifiedName qn) throws CoreException {
    return getProxy().getSessionProperty(qn);
  }

  @Override
  public int getType() {
    return getProxy().getType();
  }

  @Override
  public IWorkspace getWorkspace() {
    return getProxy().getWorkspace();
  }

  @Override
  public boolean isAccessible() {
    return getProxy().isAccessible();
  }

  @Override
  public boolean isDerived() {
    return getProxy().isDerived();
  }

  @Override
  public boolean isDerived(int i) {
    return getProxy().isDerived(i);
  }

  @Override
  public boolean isHidden() {
    return getProxy().isHidden();
  }

  @Override
  public boolean isHidden(int i) {
    return getProxy().isHidden(i);
  }

  @Override
  public boolean isLinked() {
    return getProxy().isLinked();
  }

  @Override
  public boolean isVirtual() {
    return getProxy().isVirtual();
  }

  @Override
  public boolean isLinked(int i) {
    return getProxy().isLinked(i);
  }

  @Override
  public boolean isLocal(int i) {
    return getProxy().isLocal(i);
  }

  @Override
  public boolean isPhantom() {
    return getProxy().isPhantom();
  }

  @Override
  public boolean isReadOnly() {
    return getProxy().isReadOnly();
  }

  @Override
  public boolean isSynchronized(int i) {
    return getProxy().isSynchronized(i);
  }

  @Override
  public boolean isTeamPrivateMember() {
    return getProxy().isTeamPrivateMember();
  }

  @Override
  public boolean isTeamPrivateMember(int i) {
    return getProxy().isTeamPrivateMember(i);
  }

  @Override
  public void move(IPath ipath, boolean bln, IProgressMonitor ipm) throws CoreException {
    getProxy().move(ipath, bln, ipm);
  }

  @Override
  public void move(IPath ipath, int i, IProgressMonitor ipm) throws CoreException {
    getProxy().move(ipath, i, ipm);
  }

  @Override
  public void move(IProjectDescription ipd, boolean bln, boolean bln1, IProgressMonitor ipm)
      throws CoreException {
    getProxy().move(ipd, bln, bln1, ipm);
  }

  @Override
  public void move(IProjectDescription ipd, int i, IProgressMonitor ipm) throws CoreException {
    getProxy().move(ipd, i, ipm);
  }

  @Override
  public void refreshLocal(int i, IProgressMonitor ipm) throws CoreException {
    getProxy().refreshLocal(i, ipm);
  }

  @Override
  public void revertModificationStamp(long l) throws CoreException {
    getProxy().revertModificationStamp(l);
  }

  @Override
  public void setDerived(boolean bln) throws CoreException {
    getProxy().setDerived(bln);
  }

  @Override
  public void setDerived(boolean bln, IProgressMonitor ipm) throws CoreException {
    getProxy().setDerived(bln, ipm);
  }

  @Override
  public void setHidden(boolean bln) throws CoreException {
    getProxy().setHidden(bln);
  }

  @Override
  public void setLocal(boolean bln, int i, IProgressMonitor ipm) throws CoreException {
    getProxy().setLocal(bln, i, ipm);
  }

  @Override
  public long setLocalTimeStamp(long l) throws CoreException {
    return getProxy().setLocalTimeStamp(l);
  }

  @Override
  public void setPersistentProperty(QualifiedName qn, String string) throws CoreException {
    getProxy().setPersistentProperty(qn, string);
  }

  @Override
  public void setReadOnly(boolean bln) {
    getProxy().setReadOnly(bln);
  }

  @Override
  public void setResourceAttributes(ResourceAttributes ra) throws CoreException {
    getProxy().setResourceAttributes(ra);
  }

  @Override
  public void setSessionProperty(QualifiedName qn, Object o) throws CoreException {
    getProxy().setSessionProperty(qn, o);
  }

  @Override
  public void setTeamPrivateMember(boolean bln) throws CoreException {
    getProxy().setTeamPrivateMember(bln);
  }

  @Override
  public void touch(IProgressMonitor ipm) throws CoreException {
    getProxy().touch(ipm);
  }

  @Override
  public <T> T getAdapter(Class<T> type) {
    return getProxy().getAdapter(type);
  }

  @Override
  public boolean contains(ISchedulingRule isr) {
    return getProxy().contains(isr);
  }

  @Override
  public boolean isConflicting(ISchedulingRule isr) {
    return getProxy().isConflicting(isr);
  }

  @Override
  public void build(int i, String string, Map<String, String> map, IProgressMonitor ipm)
      throws CoreException {
    getProxy().build(i, string, map, ipm);
  }

  @Override
  public void build(int i, IProgressMonitor ipm) throws CoreException {
    getProxy().build(i, ipm);
  }

  @Override
  public void build(IBuildConfiguration ibc, int i, IProgressMonitor ipm) throws CoreException {
    getProxy().build(ibc, i, ipm);
  }

  @Override
  public void close(IProgressMonitor ipm) throws CoreException {
    getProxy().close(ipm);
  }

  @Override
  public void create(IProjectDescription ipd, IProgressMonitor ipm) throws CoreException {
    getProxy().create(ipd, ipm);
  }

  @Override
  public void create(IProgressMonitor ipm) throws CoreException {
    getProxy().create(ipm);
  }

  @Override
  public void create(IProjectDescription ipd, int i, IProgressMonitor ipm) throws CoreException {
    getProxy().create(ipd, i, ipm);
  }

  @Override
  public void delete(boolean bln, boolean bln1, IProgressMonitor ipm) throws CoreException {
    getProxy().delete(bln, bln1, ipm);
  }

  @Override
  public IBuildConfiguration getActiveBuildConfig() throws CoreException {
    return getProxy().getActiveBuildConfig();
  }

  @Override
  public IBuildConfiguration getBuildConfig(String string) throws CoreException {
    return getProxy().getBuildConfig(string);
  }

  @Override
  public IBuildConfiguration[] getBuildConfigs() throws CoreException {
    return getProxy().getBuildConfigs();
  }

  @Override
  public IContentTypeMatcher getContentTypeMatcher() throws CoreException {
    return getProxy().getContentTypeMatcher();
  }

  @Override
  public IProjectDescription getDescription() throws CoreException {
    return getProxy().getDescription();
  }

  @Override
  public IFile getFile(String string) {
    return getProxy().getFile(string);
  }

  @Override
  public IFolder getFolder(String string) {
    return getProxy().getFolder(string);
  }

  @Override
  public IProjectNature getNature(String string) throws CoreException {
    return getProxy().getNature(string);
  }

  @Override
  public IPath getPluginWorkingLocation(IPluginDescriptor ipd) {
    return getProxy().getPluginWorkingLocation(ipd);
  }

  @Override
  public IPath getWorkingLocation(String string) {
    return getProxy().getWorkingLocation(string);
  }

  @Override
  public IProject[] getReferencedProjects() throws CoreException {
    return getProxy().getReferencedProjects();
  }

  @Override
  public IProject[] getReferencingProjects() {
    return getProxy().getReferencingProjects();
  }

  @Override
  public IBuildConfiguration[] getReferencedBuildConfigs(String string, boolean bln)
      throws CoreException {
    return getProxy().getReferencedBuildConfigs(string, bln);
  }

  @Override
  public boolean hasBuildConfig(String string) throws CoreException {
    return getProxy().hasBuildConfig(string);
  }

  @Override
  public boolean hasNature(String string) throws CoreException {
    return getProxy().hasNature(string);
  }

  @Override
  public boolean isNatureEnabled(String string) throws CoreException {
    return getProxy().isNatureEnabled(string);
  }

  @Override
  public boolean isOpen() {
    return getProxy().isOpen();
  }

  @Override
  public void loadSnapshot(int i, URI uri, IProgressMonitor ipm) throws CoreException {
    getProxy().loadSnapshot(i, uri, ipm);
  }

  @Override
  public void move(IProjectDescription ipd, boolean bln, IProgressMonitor ipm)
      throws CoreException {
    getProxy().move(ipd, bln, ipm);
  }

  @Override
  public void open(int i, IProgressMonitor ipm) throws CoreException {
    getProxy().open(i, ipm);
  }

  @Override
  public void open(IProgressMonitor ipm) throws CoreException {
    getProxy().open(ipm);
  }

  @Override
  public void saveSnapshot(int i, URI uri, IProgressMonitor ipm) throws CoreException {
    getProxy().saveSnapshot(i, uri, ipm);
  }

  @Override
  public void setDescription(IProjectDescription ipd, IProgressMonitor ipm) throws CoreException {
    getProxy().setDescription(ipd, ipm);
  }

  @Override
  public void setDescription(IProjectDescription ipd, int i, IProgressMonitor ipm)
      throws CoreException {
    getProxy().setDescription(ipd, i, ipm);
  }

  @Override
  public boolean exists(IPath ipath) {
    return getProxy().exists(ipath);
  }

  @Override
  public IResource findMember(String string) {
    return getProxy().findMember(string);
  }

  @Override
  public IResource findMember(String string, boolean bln) {
    return getProxy().findMember(string, bln);
  }

  @Override
  public IResource findMember(IPath ipath) {
    return getProxy().findMember(ipath);
  }

  @Override
  public IResource findMember(IPath ipath, boolean bln) {
    return getProxy().findMember(ipath, bln);
  }

  @Override
  public String getDefaultCharset() throws CoreException {
    return getProxy().getDefaultCharset();
  }

  @Override
  public String getDefaultCharset(boolean bln) throws CoreException {
    return getProxy().getDefaultCharset(bln);
  }

  @Override
  public IFile getFile(IPath ipath) {
    return getProxy().getFile(ipath);
  }

  @Override
  public IFolder getFolder(IPath ipath) {
    return getProxy().getFolder(ipath);
  }

  @Override
  public IResource[] members() throws CoreException {
    return getProxy().members();
  }

  @Override
  public IResource[] members(boolean bln) throws CoreException {
    return getProxy().members(bln);
  }

  @Override
  public IResource[] members(int i) throws CoreException {
    return getProxy().members(i);
  }

  @Override
  public IFile[] findDeletedMembersWithHistory(int i, IProgressMonitor ipm) throws CoreException {
    return getProxy().findDeletedMembersWithHistory(i, ipm);
  }

  @Override
  public void setDefaultCharset(String string) throws CoreException {
    getProxy().setDefaultCharset(string);
  }

  @Override
  public void setDefaultCharset(String string, IProgressMonitor ipm) throws CoreException {
    getProxy().setDefaultCharset(string, ipm);
  }

  @Override
  public IResourceFilterDescription createFilter(
      int i, FileInfoMatcherDescription fimd, int i1, IProgressMonitor ipm) throws CoreException {
    return getProxy().createFilter(i, fimd, i1, ipm);
  }

  @Override
  public IResourceFilterDescription[] getFilters() throws CoreException {
    return getProxy().getFilters();
  }
}
