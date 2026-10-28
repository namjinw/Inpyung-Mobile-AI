// 메인 프로세스: 창, IPC, 설치 단계 진행(F1), 종료 시 정리(F7)
const { app, BrowserWindow, ipcMain } = require('electron')

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

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'))
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
    minWidth: 800, // 이보다 작으면 스크롤 없이 한 화면에 담기지 않아서 줄이지 못하게 한다.
    minHeight: 660,
    title: 'Claude Code 대회 준비 도구',
    backgroundColor: '#14151a',
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
    step(2, '클로드 설치', 'done', 100, cl.version)

    step(3, 'Git 준비', 'running')
    const g = await install.git(cfg, (pct, msg) => step(3, 'Git 준비', 'running', pct, msg))
    step(3, 'Git 준비', 'done', 100, g.mode === 'system' ? '이미 설치된 Git을 사용해요.' : '휴대용 Git을 준비했어요.')

    step(4, '클로드 환경 설정 가져오기', 'running')
    let applied = 0
    if (settings.isPlaceholder(cfg)) {
      step(4, '클로드 환경 설정 가져오기', 'skipped', 100, '설정 저장소가 아직 정해지지 않아서 건너뛰었어요. (app/config.json에서 설정)')
    } else {
      step(4, '클로드 환경 설정 가져오기', 'running', 15, '설정 저장소에서 설정을 받는 중… GitHub 로그인 창이 뜨면 로그인해 주세요.')
      const plan = await settings.plan(cfg, g.gitExe)
      step(4, '클로드 환경 설정 가져오기', 'running', 40, '적용할 파일을 확인해 주세요.')
      const ok = await ask(plan)
      if (!ok) step(4, '클로드 환경 설정 가져오기', 'skipped', 100, '설정 적용을 건너뛰었어요.')
      else {
        const r = await settings.apply(cfg, (pct, msg) => step(4, '클로드 환경 설정 가져오기', 'running', pct, msg))
        applied = r.applied
        step(4, '클로드 환경 설정 가져오기', 'done', 100, `${applied}개 항목을 적용했어요.`)
      }
    }

    session.writeState({ ready: true, claudeVersion: cl.version, bashPath: g.bashPath })
    send('state', { phase: 'ready' })
    log('설치가 끝났어요. [실행] 버튼을 눌러 Claude Code를 시작하세요.')
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

ipcMain.handle('info', () => ({ ready: session.isReady(), placeholder: settings.isPlaceholder(cfg), repo: cfg.settingsRepo, tag: cfg.settingsTag, work: paths.dirs.work }))
ipcMain.handle('check', () => check.run(cfg))
ipcMain.handle('install', () => runInstall())
ipcMain.handle('launch', async () => {
  if (!session.isReady()) return { ok: false, error: '아직 설치가 끝나지 않았어요. 먼저 [설치]를 눌러 주세요.' }
  session.launch(session.readState().bashPath)
  send('state', { phase: 'running' })
  startPolling()
  return { ok: true }
})
ipcMain.handle('reset', async () => {
  if (busy) return { ok: false, error: '설치가 진행 중이에요. 끝난 뒤에 다시 눌러 주세요.' }
  clearInterval(pollTimer)
  const r = await session.reset()
  send('state', { phase: 'idle', reset: true })
  return r
})

// 앱을 끄면 claude 종료 → 전용 폴더 삭제 후 끝낸다. (강제 종료로 못 지우면 다음 시작 때 지운다.)
app.on('before-quit', async (e) => {
  if (quitting) return
  e.preventDefault()
  quitting = true
  clearInterval(pollTimer)
  await session.reset().catch(() => {})
  app.exit(0)
})
app.on('window-all-closed', () => app.quit())

app.whenReady().then(async () => {
  paths.init(app.getPath('documents'))
  const r = await session.startupCleanup() // [F8] 화면을 띄우기 전에 먼저 끝내야 남은 세션이 '설치 완료'로 보이지 않는다.
  createWindow()
  win.webContents.once('did-finish-load', () => log(r.ok ? '이전 실행에서 남은 파일이 없는지 확인했어요.' : r.err))
  if (SMOKE) {
    win.webContents.once('did-finish-load', async () => {
      await new Promise((r2) => setTimeout(r2, 1500))
      const out = await win.webContents.executeJavaScript(`JSON.stringify({title:document.title,btn:document.getElementById('main').textContent,steps:document.querySelectorAll('.step').length,env:document.querySelectorAll('#env li').length,api:typeof window.api})`)
      console.log('SMOKE ' + out)
      app.exit(0)
    })
  }
})
