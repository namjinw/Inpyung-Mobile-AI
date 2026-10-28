// 경로 상수와 안전 삭제. 이 앱이 지울 수 있는 곳은 SESSION 폴더 하나뿐이다.
const path = require('path')
const fs = require('fs')
const os = require('os')

// CLAUDE_CONTEST_ROOT는 테스트 전용 (평소에는 %LOCALAPPDATA%\ClaudeContest)
const ROOT = process.env.CLAUDE_CONTEST_ROOT || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ClaudeContest')
const SESSION = path.join(ROOT, 'session') // 설치물, 로그인 정보, 로그 (종료 때 통째로 삭제)
const CACHE = path.join(ROOT, 'cache') // 내려받은 설치 파일 (삭제 대상 아님)
const MARKER = '.claude-contest-session'

const dirs = {
  ROOT,
  SESSION,
  CACHE,
  bin: path.join(SESSION, 'bin'),
  config: path.join(SESSION, 'config'),
  git: path.join(SESSION, 'git'),
  logs: path.join(SESSION, 'logs'),
  tmp: path.join(SESSION, 'tmp'),
  work: path.join(os.homedir(), 'Documents', 'ClaudeContest', 'work'), // 참가자 작업물 (삭제 대상 아님)
}
dirs.claudeExe = path.join(dirs.bin, 'claude.exe')
dirs.state = path.join(SESSION, 'state.json')

// 문서 폴더가 OneDrive로 옮겨진 PC도 있어서 main에서 실제 위치를 넘겨받는다.
function init(documentsPath) {
  if (documentsPath && !process.env.CLAUDE_CONTEST_ROOT) dirs.work = path.join(documentsPath, 'ClaudeContest', 'work')
}

// child가 parent 안(또는 같은 경로)에 있는지
const isInside = (parent, child) => {
  const r = path.relative(parent, child)
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r))
}

// git이 받은 .git/objects 파일은 읽기 전용이라 그대로는 지워지지 않는다(EPERM). 읽기 전용을 풀고 지운다.
function unlockAll(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) unlockAll(p)
    else if (e.isFile()) fs.chmodSync(p, 0o666)
  }
}
const RM = { recursive: true, force: true, maxRetries: 8, retryDelay: 400 }
function forceRemove(dir) {
  if (!fs.existsSync(dir)) return
  try {
    unlockAll(dir)
  } catch {} // 잠금 해제에 실패해도 아래 삭제에서 오류를 알려준다.
  fs.rmSync(dir, RM)
}

async function safeRemoveSession() {
  const target = path.resolve(SESSION)
  if (!fs.existsSync(target)) return { ok: true }
  if (target !== path.resolve(ROOT, 'session')) return { ok: false, err: '삭제할 폴더 경로가 올바르지 않아서 중단했어요.' }
  if (!fs.existsSync(path.join(target, MARKER))) return { ok: false, err: '이 앱이 만든 폴더가 아니라서 삭제하지 않았어요.' }
  const home = os.homedir()
  const protectedPaths = [home, path.join(home, '.claude'), path.join(home, '.local'), dirs.work]
  if (protectedPaths.some((p) => isInside(target, p))) return { ok: false, err: '내 파일이 들어 있을 수 있는 폴더라서 삭제하지 않았어요.' }
  try {
    forceRemove(target)
    return { ok: true }
  } catch (e) {
    return { ok: false, err: `폴더를 지우지 못했어요. 다음에 앱을 켤 때 다시 지워요. (${e.code || e.message})` }
  }
}

function prepareSession() {
  for (const d of [dirs.bin, dirs.config, dirs.logs, dirs.tmp, dirs.CACHE]) fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(path.join(SESSION, MARKER), 'claude-contest-tool session folder. 이 폴더는 앱 종료 때 통째로 삭제돼요.\n')
}

module.exports = { dirs, init, isInside, safeRemoveSession, prepareSession, forceRemove }
