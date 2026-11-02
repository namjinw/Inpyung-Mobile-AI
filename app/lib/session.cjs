// [F7][F8] 세션 상태, 실행, 종료 시 삭제, 시작 시 잔여물 정리
const fs = require('fs')
const { spawn, execFile } = require('child_process')
const { dirs, safeRemoveSession, prepareSession } = require('./paths.cjs')
const { sessionPids, killSessionProcs } = require('./procs.cjs')
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

// 지우고 결과를 돌려준다. 지우지 못해도 앱은 계속 동작하고, 다음 시작 때 다시 지운다.
async function wipe() {
  const killed = await killSessionProcs()
  if (killed) log(`전용 폴더에서 실행 중이던 프로그램 ${killed}개를 종료했어요.`)
  const r = await safeRemoveSession()
  return r
}

// [F8] 시작할 때 이전 세션이 남아 있으면 먼저 지운다.
async function startupCleanup() {
  const r = await wipe()
  return r
}

// [F7] 종료/리셋: claude 종료 → 전용 폴더 삭제 (로그인 정보도 이 폴더 안에 있어서 함께 삭제됨)
async function reset() {
  const r = await wipe()
  log(r.ok ? '전용 폴더를 삭제했어요. 로그인 정보도 함께 지워졌어요.' : r.err)
  return r
}

// claude를 새 콘솔 창에서 실행 (참가자 작업물 폴더에서 시작)
function launch(bashPath) {
  fs.mkdirSync(dirs.work, { recursive: true })
  const cmd = `start "Claude Code" /D "${dirs.work}" "${dirs.claudeExe}"`
  const child = spawn('cmd.exe', ['/d', '/s', '/c', `"${cmd}"`], { env: buildEnv(bashPath), detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true })
  child.unref()
  log(`Claude Code를 실행했어요. 작업 폴더: ${dirs.work}`)
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

module.exports = { prepareSession, readState, writeState, isReady, startupCleanup, reset, launch, isRunning, isLoggedIn, login }
