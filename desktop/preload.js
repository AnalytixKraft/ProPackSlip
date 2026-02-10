const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('packpro', {
  isDesktop: true,
  quit: () => ipcRenderer.send('app:quit'),
  print: () => ipcRenderer.invoke('app:print'),
})
