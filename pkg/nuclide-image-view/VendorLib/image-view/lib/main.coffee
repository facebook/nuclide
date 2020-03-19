# @generated SignedSource<<5d5d9041fbce3a1276115c327b031f68>>
path = require 'path'
_ = require 'underscore-plus'
ImageEditor = require './image-editor'
{CompositeDisposable} = require 'atom'

module.exports =
  activate: ->
    @statusViewAttached = null
    @disposables = new CompositeDisposable
    @disposables.add atom.workspace.addOpener(openURI)
    @disposables.add atom.workspace.getCenter().onDidChangeActivePaneItem => @attachImageEditorStatusView()

  deactivate: ->
    @statusViewAttached?.destroy()
    @disposables.dispose()

  consumeStatusBar: (@statusBar) -> @attachImageEditorStatusView()

  attachImageEditorStatusView: ->
    return if @statusViewAttached
    return unless @statusBar?
    return unless atom.workspace.getCenter().getActivePaneItem() instanceof ImageEditor

    ImageEditorStatusView = require './image-editor-status-view'
    @statusViewAttached = new ImageEditorStatusView(@statusBar)
    @statusViewAttached.attach()

  deserialize: (state) ->
    ImageEditor.deserialize(state)

# Files with these extensions will be opened as images
imageExtensions = ['.bmp', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.webp']
openURI = (uriToOpen) ->
  uriExtension = path.extname(uriToOpen).toLowerCase()
  if _.include(imageExtensions, uriExtension)
    new ImageEditor(uriToOpen)
