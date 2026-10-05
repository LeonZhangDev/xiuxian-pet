// 绕过包装 node 的 CLI 参数问题，直接用 electron-builder JS API 打包
// 关键：本机 node 实为 Electron，fs 会把 .asar 当目录穿透，导致 builder 的
// “文件是否存在” 探测（readAsarJson / readdir 进入 default_app.asar）报错。
// 关掉 Electron 的 asar 透明访问，让构建器把 asar 当普通文件处理。
process.noAsar = true
const builder = require('electron-builder')

builder
  .build({
    targets: builder.Platform.WINDOWS.createTarget(),
    config: {
      asar: false,
      electronDist: 'C:\\Users\\admin\\AppData\\Local\\Temp\\electron-dist-44.5.1',
      directories: {
        output: 'C:\\Users\\admin\\AppData\\Local\\Temp\\xiuxian-release',
      },
    },
  })
  .then((files) => {
    console.log('BUILD OK')
    for (const f of files) console.log(' -', f)
  })
  .catch((e) => {
    console.error('BUILD FAILED:', e.stack || e.message || e)
    process.exit(1)
  })
