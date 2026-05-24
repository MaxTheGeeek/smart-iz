import { app, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

let mainWindow: BrowserWindow | null = null
let sidecar: ChildProcess | null = null

const isDev = !app.isPackaged

function spawnSidecar() {
  const sidecarPath = isDev
    ? path.join(__dirname, '../../sidecar/main.py')
    : path.join(process.resourcesPath, 'sidecar/smartiz-sidecar')

  const command = isDev
    ? (process.platform === 'win32' ? 'python' : 'python3')
    : sidecarPath

  const args = isDev
    ? [path.join(__dirname, '../../sidecar/main.py'), '--port', '8765']
    : ['--port', '8765']

  console.log(`[main] Spawning sidecar: ${command} ${args.join(' ')}`)

  sidecar = spawn(command, args, {
    cwd: isDev ? path.join(__dirname, '../../sidecar') : undefined,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  sidecar.stdout?.on('data', (d) => console.log('[sidecar]', d.toString().trim()))
  sidecar.stderr?.on('data', (d) => console.error('[sidecar err]', d.toString().trim()))
  sidecar.on('close', (code) => console.log('[sidecar] exited with code', code))
}

async function waitForSidecar(callback: () => void) {
  const url = 'http://127.0.0.1:8765/health'
  let attempts = 0
  const maxAttempts = 30 // 15 seconds max

  const poll = async () => {
    try {
      const res = await fetch(url)
      if (res.ok) {
        console.log('[main] Sidecar health check passed!')
        callback()
        return
      }
    } catch (e) {
      // Ignored
    }

    attempts++
    if (attempts < maxAttempts) {
      setTimeout(poll, 500)
    } else {
      console.error('[main] Sidecar failed to start in time. Launching window anyway.')
      callback()
    }
  }

  poll()
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    resizable: false,
    maximizable: false,
    useContentSize: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', () => {
  spawnSidecar()
  waitForSidecar(() => createWindow())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

app.on('quit', () => {
  if (sidecar) {
    console.log('[main] Killing sidecar process')
    sidecar.kill()
  }
})
