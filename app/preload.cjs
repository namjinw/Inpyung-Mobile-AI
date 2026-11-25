// 화면(renderer)에 공개하는 함수는 여기 적힌 것뿐이다.
const { contextBridge, ipcRenderer } = require('electron')

const on = (ch) => (cb) => ipcRenderer.on(ch, (_e, data) => cb(data))

contextBridge.exposeInMainWorld('api', {
  info: () => ipcRenderer.invoke('info'),
  check: () => ipcRenderer.invoke('check'),
  install: () => ipcRenderer.invoke('install'),
  login: () => ipcRenderer.invoke('login'),
  launch: (opts) => ipcRenderer.invoke('launch', opts),
  folders: () => ipcRenderer.invoke('folders'),
  chats: (f) => ipcRenderer.invoke('chats', f),
  setProblem: (action) => ipcRenderer.invoke('set-problem', action),
  addFolder: () => ipcRenderer.invoke('add-folder'),
  removeFolder: (f) => ipcRenderer.invoke('remove-folder', f),
  openFolder: (f) => ipcRenderer.invoke('open-folder', f),
  settingsReply: (ok) => ipcRenderer.send('settings-reply', ok),
  onStep: on('step'),
  onLog: on('log'),
  onState: on('state'),
  onConfirmSettings: on('confirm-settings'),
})
