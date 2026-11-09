// 상태 저장, 로그인 확인, 실행 (설치물과 로그인 정보는 지우지 않고 계속 쓴다)
const fs = require('fs')
const { spawn, execFile } = require('child_process')
const path = require('path')
const { dirs, prepareSession } = require('./paths.cjs')
const { sessionPids } = require('./procs.cjs')
const { buildEnv } = require('./env.cjs')
const { log } = require('./log.cjs')

const readState = () => {
  try {
    return JSON.parse(fs.readFileSync(dirs.state, 'utf8'))
  } catch {
    return {}
  }
}
const writeState = (patch) => fs.writeFileSync(dirs.state, JSON.stringify({ ...readState(), ...patch }, null, 2))
const isReady = () => !!readState().ready && fs.existsSync(dirs.claudeExe)

// 처음 켤 때 한 번만 기본값을 넣는다: 테마 dark, 온보딩(테마 고르기) 건너뛰기. 이미 있는 값은 바꾸지 않는다. (토큰은 다루지 않는다.)
function seedConfig() {
  const file = path.join(dirs.config, '.claude.json')
  let j = {}
  try {
    j = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {} // 없거나 읽을 수 없으면 새로 만든다.
  let changed = false
  if (j.theme === undefined) ((j.theme = 'dark'), (changed = true))
  if (j.hasCompletedOnboarding === undefined) ((j.hasCompletedOnboarding = true), (changed = true))
  if (!changed) return
  fs.mkdirSync(dirs.config, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(j, null, 2))
}

// 이 작업 폴더에서 이전에 나눈 대화가 있는지 (있으면 --continue로 이어서 시작한다)
function hasPreviousChat() {
  try {
    const dir = path.join(dirs.config, 'projects', dirs.work.replace(/[^a-zA-Z0-9]/g, '-'))
    return fs.readdirSync(dir).some((f) => f.endsWith('.jsonl'))
  } catch {
    return false
  }
}

// claude를 새 콘솔 창에서 실행 (참가자 작업물 폴더에서 시작). 이미 열린 창이 없고 이전 대화가 있으면 이어서 시작한다.
async function launch(bashPath) {
  fs.mkdirSync(dirs.work, { recursive: true })
  seedConfig()
  const resume = hasPreviousChat() && !(await sessionPids()).length
  const cmd = `start "Claude Code" /D "${dirs.work}" "${dirs.claudeExe}"${resume ? ' --continue' : ''}`
  const child = spawn('cmd.exe', ['/d', '/s', '/c', `"${cmd}"`], { env: buildEnv(bashPath), detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true })
  child.unref()
  log(`Claude Code를 실행했어요.${resume ? ' 이전 대화를 이어서 시작해요.' : ''} 작업 폴더: ${dirs.work}`)
}

// 로그인 여부: claude가 직접 확인한다. (이 앱은 토큰을 읽거나 저장하지 않는다.)
const isLoggedIn = (bashPath) =>
  new Promise((resolve) =>
    execFile(dirs.claudeExe, ['auth', 'status'], { env: buildEnv(bashPath), windowsHide: true, timeout: 20000 }, (e, out) => {
      if (e) return resolve(false)
      try {
        resolve(JSON.parse(String(out)).loggedIn !== false)
      } catch {
        resolve(true) // 종료 코드가 0이면 로그인된 상태
      }
    }),
  )

// 로그인 창(claude auth login)을 열고, 로그인이 끝날 때까지 기다린다. 로그인 정보는 전용 폴더(CLAUDE_CONFIG_DIR)에 claude가 저장한다.
async function login(bashPath) {
  fs.mkdirSync(dirs.work, { recursive: true })
  seedConfig()
  const cmd = `start "Claude 로그인" /D "${dirs.work}" "${dirs.claudeExe}" auth login`
  const child = spawn('cmd.exe', ['/d', '/s', '/c', `"${cmd}"`], { env: buildEnv(bashPath), detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true })
  child.unref()
  log('로그인 창을 열었어요. 브라우저에서 로그인을 마쳐 주세요.')
  const until = Date.now() + 5 * 60 * 1000
  const began = Date.now()
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 3000))
    if (await isLoggedIn(bashPath)) return { ok: true }
    if (Date.now() - began > 15000 && !(await sessionPids()).length) return { ok: false, error: '로그인 창이 닫혔어요. 로그인이 끝나지 않았어요. 다시 [로그인]을 눌러 주세요.' }
  }
  return { ok: false, error: '로그인 시간이 지났어요. 다시 [로그인]을 눌러 주세요.' }
}

const isRunning = async () => (await sessionPids()).length > 0

module.exports = { prepareSession, readState, writeState, isReady, launch, isRunning, isLoggedIn, login }
