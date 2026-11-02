// 화면(renderer)에 공개하는 함수는 여기 적힌 것뿐이다.
const { contextBridge, ipcRenderer } = require('electron')

const on = (ch) => (cb) => ipcRenderer.on(ch, (_e, data) => cb(data))

contextBridge.exposeInMainWorld('api', {
  info: () => ipcRenderer.invoke('info'),
  check: () => ipcRenderer.invoke('check'),
  install: () => ipcRenderer.invoke('install'),
  login: () => ipcRenderer.invoke('login'),
  launch: () => ipcRenderer.invoke('launch'),
  reset: () => ipcRenderer.invoke('reset'),
  settingsReply: (ok) => ipcRenderer.send('settings-reply', ok),
  onStep: on('step'),
  onLog: on('log'),
  onState: on('state'),
  onConfirmSettings: on('confirm-settings'),
})
