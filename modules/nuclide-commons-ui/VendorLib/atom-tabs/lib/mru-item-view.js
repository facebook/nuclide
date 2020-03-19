'use babel'

import FileIcons from './file-icons'
import path from 'path'

export default class MRUItemView {
  initialize (listView, item) {
    this.listView = listView
    this.item = item

    this.element = document.createElement('li')
    this.element.itemViewData = this
    this.element.classList.add('two-lines')

    let itemPath = null
    if (item.getPath && typeof item.getPath === 'function') {
      itemPath = item.getPath()
    }

    const repo = MRUItemView.repositoryForPath(itemPath)
    if (repo != null) {
      const statusIconDiv = document.createElement('div')
      const status = repo.getCachedPathStatus(itemPath)
      if (repo.isStatusNew(status)) {
        statusIconDiv.className = 'status status-added icon icon-diff-added'
        this.element.appendChild(statusIconDiv)
      } else if (repo.isStatusModified(status)) {
        statusIconDiv.className = 'status status-modified icon icon-diff-modified'
        this.element.appendChild(statusIconDiv)
      }
    }

    const firstLineDiv = this.element.appendChild(document.createElement('div'))
    firstLineDiv.classList.add('primary-line', 'file')
    if (typeof item.getIconName === 'function') {
      if (atom.config.get('tabs.showIcons')) firstLineDiv.classList.add('icon', 'icon-' + item.getIconName())
    } else {
      let typeClasses = FileIcons.getService().iconClassForPath(itemPath, 'tabs-mru-switcher')
      if (typeClasses) {
        if (!Array.isArray(typeClasses)) typeClasses = typeClasses.split(/\s+/g)
        if (typeClasses) firstLineDiv.classList.add('icon', ...typeClasses)
      }
    }
    firstLineDiv.setAttribute('data-name', item.getTitle())
    firstLineDiv.innerText = item.getTitle()

    if (itemPath) {
      firstLineDiv.setAttribute('data-path', itemPath)
      const secondLineDiv = this.element.appendChild(document.createElement('div'))
      secondLineDiv.classList.add('secondary-line', 'path', 'no-icon')
      secondLineDiv.innerText = itemPath
    }
  }

  select () {
    this.element.classList.add('selected')
  }

  unselect () {
    this.element.classList.remove('selected')
  }

  static repositoryForPath (filePath) {
    if (filePath) {
      const projectPaths = atom.project.getPaths()
      for (let i = 0; i < projectPaths.length; i++) {
        if (filePath === projectPaths[i] || filePath.startsWith(projectPaths[i] + path.sep)) {
          return atom.project.getRepositories()[i]
        }
      }
    }
    return null
  }
}
