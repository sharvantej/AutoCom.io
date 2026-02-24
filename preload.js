const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("autoOsc", {
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
});
