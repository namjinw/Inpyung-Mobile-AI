// 메인 프로세스: 창, IPC, 설치 단계 진행(F1). 앱을 닫아도 설치물과 로그인 정보는 지우지 않는다.
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')

// 두 번째로 켠 앱은 아무것도 등록하지 않고 바로 끝낸다. (먼저 켜진 앱의 전용 폴더를 지우면 안 된다.)
if (!app.requestSingleInstanceLock()) {
  app.exit(0)
  return
}

const path = require('path')
const fs = require('fs')
const paths = require('./lib/paths.cjs')
const { log, setSink } = require('./lib/log.cjs')
const check = require('./lib/check.cjs')
const install = require('./lib/install.cjs')
const settings = require('./lib/settings.cjs')
const session = require('./lib/session.cjs')

const cfg = require('./lib/envfile.cjs').load(JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')))
const SMOKE = process.argv.includes('--smoke') // 화면이 뜨는지만 확인하고 끝내는 테스트용

let win = null
let busy = false // 설치 진행 중 (중복 클릭 방지)
let quitting = false
let pollTimer = null
let askResolver = null // 설정 적용 확인 창의 응답을 기다리는 Promise

const send = (ch, data) => win && !win.isDestroyed() && win.webContents.send(ch, data)
setSink((line) => send('log', line))

app.on('second-instance', () => win && (win.isMinimized() && win.restore(), win.focus()))

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 860,
    minHeight: 600,
    title: 'Claude Code 대회 준비 도구',
    backgroundColor: '#1a1816',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.setMenuBarVisibility(false)
  win.loadFile(path.join(__dirname, 'ui', 'index.html'))
}

// 설정 적용 전에 파일 목록을 보여주고 사용자의 확인을 기다린다.
const ask = (data) => new Promise((resolve) => ((askResolver = resolve), send('confirm-settings', data)))
ipcMain.on('settings-reply', (_e, ok) => askResolver && (askResolver(!!ok), (askResolver = null)))

async function runInstall() {
  if (busy) return { ok: false, error: '이미 설치가 진행 중이에요.' }
  busy = true
  const total = 4
  let cur = { i: 1, label: '환경 점검' }
  const step = (i, label, status, pct = 0, msg = '') => ((cur = { i, label }), send('step', { index: i, total, label, status, pct, msg }))
  try {
    session.prepareSession()
    log('설치를 시작해요.')

    step(1, '환경 점검', 'running')
    const c = await check.run(cfg)
    if (c.blocking) throw new Error(c.blockMsg)
    step(1, '환경 점검', 'done', 100, '문제 없어요.')

    step(2, '클로드 설치', 'running')
    const cl = await install.claude(cfg, (pct, msg) => step(2, '클로드 설치', 'running', pct, msg))
    step(2, '클로드 설치', 'done', 100, cl.reused ? cl.version : `Claude Code ${cl.version}`)

    step(3, 'Git 준비', 'running')
    const g = await install.git(cfg, (pct, msg) => step(3, 'Git 준비', 'running', pct, msg))
    step(3, 'Git 준비', 'done', 100, g.mode === 'system' ? '이미 설치된 Git을 사용해요.' : '휴대용 Git을 준비했어요.')

    step(4, '클로드 환경 설정 가져오기', 'running')
    let applied = 0
    let appliedTag = ''
    if (settings.isPlaceholder(cfg)) {
      step(4, '클로드 환경 설정 가져오기', 'skipped', 100, '설정 저장소가 아직 정해지지 않아서 건너뛰었어요. (app/config.json에서 설정)')
    } else {
      step(4, '클로드 환경 설정 가져오기', 'running', 15, '설정 저장소에서 설정을 받는 중… GitHub 로그인 창이 뜨면 로그인해 주세요.')
      const plan = await settings.plan(cfg, g.gitExe)
      step(4, '클로드 환경 설정 가져오기', 'running', 40, '적용할 파일을 확인해 주세요.')
      // 설정(CLAUDE.md, 권한 제한, /report)이 빠진 채로 실행되지 않도록, 적용하지 않으면 설치를 마치지 않는다.
      if (!(await ask(plan))) {
        settings.cleanup()
        throw new Error('설정을 적용하지 않으면 설치를 마칠 수 없어서 중단했어요. 다시 [설치]를 눌러 주세요.')
      }
      const r = await settings.apply(cfg, (pct, msg) => step(4, '클로드 환경 설정 가져오기', 'running', pct, msg))
      applied = r.applied
      appliedTag = plan.tag
      step(4, '클로드 환경 설정 가져오기', 'done', 100, `${applied}개 항목을 적용했어요.`)
    }

    session.writeState({ ready: true, settingsTag: appliedTag, claudeVersion: cl.version, claudePath: paths.dirs.claudeExe, bashPath: g.bashPath })
    const loggedIn = await session.isLoggedIn(g.bashPath)
    send('state', { phase: loggedIn ? 'ready' : 'login' })
    log(loggedIn ? '설치가 끝났어요. [실행] 버튼을 눌러 Claude Code를 시작하세요.' : '설치가 끝났어요. [로그인]을 눌러 Claude 계정으로 로그인해 주세요.')
    return { ok: true }
  } catch (e) {
    log(`오류: ${e.message}`)
    send('step', { index: cur.i, total, label: cur.label, status: 'failed', pct: 0, msg: e.message })
    send('state', { phase: 'idle', failed: true })
    return { ok: false, error: e.message }
  } finally {
    busy = false
  }
}

function startPolling() {
  clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    if (await session.isRunning()) return
    clearInterval(pollTimer)
    send('state', { phase: 'ready', exited: true })
    log('Claude Code가 종료됐어요.')
  }, 3000)
}

// 우리 화면(file://)에서 온 요청만 받는다.
const trusted = (e) => !!e.senderFrame && e.senderFrame.url.startsWith('file://')
const folderInfo = (f) => {
  const chats = session.listChats(f)
  return { path: f, name: path.basename(f) || f, isDefault: f === paths.dirs.work, chats: chats.length, last: chats[0] || 0, exists: fs.existsSync(f) }
}

ipcMain.handle('info', async () => ({ version: app.getVersion(), problemDir: session.getProblemDir(), ready: session.isReady(), loggedIn: session.isReady() && (await session.isLoggedIn(session.readState().bashPath)), placeholder: settings.isPlaceholder(cfg), repo: cfg.settingsRepo, tag: session.readState().settingsTag || cfg.settingsTag, work: paths.dirs.work }))
ipcMain.handle('check', () => check.run(cfg))
ipcMain.handle('folders', () => session.listFolders().map(folderInfo))
ipcMain.handle('chats', (e, f) => (trusted(e) && session.listFolders().includes(f) ? session.listChats(f) : []))
ipcMain.handle('add-folder', async (e) => {
  if (!trusted(e)) return { ok: false, error: '허용되지 않은 요청이에요.' }
  const r = await dialog.showOpenDialog(win, { title: '작업 폴더 선택', properties: ['openDirectory', 'createDirectory'] })
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true }
  const bad = session.checkFolder(r.filePaths[0])
  if (bad) return { ok: false, error: bad }
  session.addFolder(r.filePaths[0])
  return { ok: true, path: r.filePaths[0] }
})
// 문제 폴더: 고르거나(pick) 비운다(clear)
ipcMain.handle('set-problem', async (e, action) => {
  if (!trusted(e)) return { ok: false, error: '허용되지 않은 요청이에요.' }
  if (action === 'clear') return (session.setProblemDir(''), { ok: true, path: '' })
  const r = await dialog.showOpenDialog(win, { title: '문제 폴더 선택', properties: ['openDirectory'] })
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true }
  const bad = session.checkFolder(r.filePaths[0])
  if (bad) return { ok: false, error: bad }
  session.setProblemDir(r.filePaths[0])
  return { ok: true, path: r.filePaths[0] }
})
ipcMain.handle('remove-folder', (e, f) => (trusted(e) ? (session.removeFolder(f), { ok: true }) : { ok: false }))
ipcMain.handle('open-folder', async (e, f) => {
  if (!trusted(e) || !session.listFolders().includes(f)) return { ok: false, error: '목록에 없는 폴더예요.' }
  const err = await shell.openPath(f)
  return err ? { ok: false, error: err } : { ok: true }
})
ipcMain.handle('install', () => runInstall())
ipcMain.handle('login', async () => {
  if (!session.isReady()) return { ok: false, error: '아직 설치가 끝나지 않았어요. 먼저 [설치]를 눌러 주세요.' }
  send('state', { phase: 'loggingin' })
  const r = await session.login(session.readState().bashPath)
  send('state', { phase: r.ok ? 'ready' : 'login' })
  if (r.ok) log('로그인했어요. 이제 [실행]으로 Claude Code를 여러 개 열 수 있어요. 로그인은 모든 창에서 함께 쓰여요.')
  return r
})
ipcMain.handle('launch', async (e, opts = {}) => {
  if (!trusted(e)) return { ok: false, error: '허용되지 않은 요청이에요.' }
  const folder = session.listFolders().includes(opts.folder) ? opts.folder : paths.dirs.work
  const mode = opts.mode === 'new' ? 'new' : 'continue'
  if (!session.isReady()) return { ok: false, error: '아직 설치가 끝나지 않았어요. 먼저 [설치]를 눌러 주세요.' }
  if (!(await session.isLoggedIn(session.readState().bashPath))) {
    send('state', { phase: 'login' })
    return { ok: false, error: '먼저 [로그인]을 해 주세요.' }
  }
  try {
    await session.launch(session.readState().bashPath, folder, mode)
  } catch (err) {
    return { ok: false, error: err.message }
  }
  send('state', { phase: 'running' })
  startPolling()
  return { ok: true }
})
app.on('window-all-closed', () => app.quit())

app.whenReady().then(async () => {
  paths.init(app.getPath('documents'))
  createWindow()
  if (SMOKE) {
    win.webContents.once('did-finish-load', async () => {
      await new Promise((r2) => setTimeout(r2, 1500))
      const out = await win.webContents.executeJavaScript(`JSON.stringify({title:document.title,view:document.body.dataset.view,steps:document.querySelectorAll('.step').length,nav:document.querySelectorAll('#side [data-page]').length,api:typeof window.api})`)
      console.log('SMOKE ' + out)
      app.exit(0)
    })
  }
})
