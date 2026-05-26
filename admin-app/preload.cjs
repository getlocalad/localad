const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStats:         ()              => ipcRenderer.invoke('get-stats'),
  getUsers:         ()              => ipcRenderer.invoke('get-users'),
  getAdvertisers:   ()              => ipcRenderer.invoke('get-advertisers'),
  getPublishers:    ()              => ipcRenderer.invoke('get-publishers'),
  getAds:           ()              => ipcRenderer.invoke('get-ads'),
  toggleAdvertiser: (id, active)   => ipcRenderer.invoke('toggle-advertiser', { id, active }),
  togglePublisher:  (id, verified) => ipcRenderer.invoke('toggle-publisher', { id, verified }),
  toggleAd:         (id, active)   => ipcRenderer.invoke('toggle-ad', { id, active }),
  healthCheck:      (url)          => ipcRenderer.invoke('health-check', url),
  startBackend:     ()              => ipcRenderer.invoke('start-backend'),
  stopBackend:      ()              => ipcRenderer.invoke('stop-backend'),
  backendRunning:   ()              => ipcRenderer.invoke('backend-running'),
  openLink:         (url)          => ipcRenderer.invoke('open-link', url),
  onBackendLog:     (cb)           => ipcRenderer.on('backend-log', (_, msg) => cb(msg)),
  onBackendStatus:  (cb)           => ipcRenderer.on('backend-status', (_, s) => cb(s)),
});
