// [F7][F8] 세션 상태, 실행, 종료 시 삭제, 시작 시 잔여물 정리
const fs = require('fs')
const { spawn } = require('child_process')
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

const isRunning = async () => (await sessionPids()).length > 0

module.exports = { prepareSession, readState, writeState, isReady, startupCleanup, reset, launch, isRunning }
