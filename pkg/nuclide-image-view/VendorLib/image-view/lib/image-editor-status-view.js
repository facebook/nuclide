/** @babel */
// @generated SignedSource<<fa48a068c0c37a842ba92cbe810846df>>

import {CompositeDisposable} from 'atom'
import ImageEditor from './image-editor'
import ImageEditorView from './image-editor-view'
import bytes from 'bytes'

export default class ImageEditorStatusView {
  constructor (statusBar) {
    this.statusBar = statusBar
    this.disposables = new CompositeDisposable()

    this.element = document.createElement('div')
    this.element.classList.add('status-image', 'inline-block')

    this.imageSizeStatus = document.createElement('span')
    this.imageSizeStatus.classList.add('image-size')
    this.element.appendChild(this.imageSizeStatus)

    this.attach()

    this.disposables.add(atom.workspace.getCenter().onDidChangeActivePaneItem(() => { this.updateImageSize() }))
  }

  attach () {
    this.statusBarTile = this.statusBar.addLeftTile({item: this})
    this.updateImageSize()
  }

  destroy () {
    this.statusBarTile.destroy()
    this.disposables.dispose()
  }

  getImageSize ({originalHeight, originalWidth, imageSize}) {
    this.imageSizeStatus.textContent = `${originalWidth}x${originalHeight} ${bytes(imageSize)}`
    this.imageSizeStatus.style.display = ''
  }

  updateImageSize () {
    if (this.imageLoadDisposable) {
      this.imageLoadDisposable.dispose()
    }

    const editor = atom.workspace.getCenter().getActivePaneItem()
    if (editor instanceof ImageEditor && editor.view instanceof ImageEditorView) {
      this.editorView = editor.view
      if (this.editorView.loaded) {
        this.getImageSize(this.editorView)
      }

      this.imageLoadDisposable = this.editorView.onDidLoad(() => {
        if (editor === atom.workspace.getCenter().getActivePaneItem()) {
          this.getImageSize(this.editorView)
        }
      })
    } else {
      this.imageSizeStatus.style.display = 'none'
    }
  }
}
