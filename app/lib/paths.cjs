// 경로 상수. 설치물, 로그인 정보, 대화 기록은 DATA 폴더에 두고 앱이 지우지 않는다.
const path = require('path')
const fs = require('fs')
const os = require('os')

// CLAUDE_CONTEST_ROOT는 테스트 전용 (평소에는 %LOCALAPPDATA%\ClaudeContest)
const ROOT = process.env.CLAUDE_CONTEST_ROOT || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ClaudeContest')
const DATA = path.join(ROOT, 'data') // 설정, 로그인 정보, 대화 기록 (영구 보관, 앱이 지우지 않음)
const CACHE = path.join(ROOT, 'cache') // 내려받은 설치 파일

const dirs = {
  ROOT,
  DATA,
  CACHE,
  bin: path.join(DATA, 'bin'),
  config: path.join(DATA, 'config'), // CLAUDE_CONFIG_DIR: 내 원래 ~/.claude와 따로 쓴다.
  git: path.join(DATA, 'git'),
  logs: path.join(DATA, 'logs'),
  tmp: path.join(DATA, 'tmp'),
  work: path.join(os.homedir(), 'Documents', 'ClaudeContest', 'work'), // 참가자 작업물
}
dirs.claudeExe = path.join(dirs.bin, 'claude.exe') // 이미 설치된 claude가 있으면 useClaude()로 그 경로로 바뀐다.
dirs.state = path.join(DATA, 'state.json')

// 문서 폴더가 OneDrive로 옮겨진 PC도 있어서 main에서 실제 위치를 넘겨받는다.
function init(documentsPath) {
  if (documentsPath && !process.env.CLAUDE_CONTEST_ROOT) dirs.work = path.join(documentsPath, 'ClaudeContest', 'work')
  try {
    const p = JSON.parse(fs.readFileSync(dirs.state, 'utf8')).claudePath
    if (p && fs.existsSync(p)) dirs.claudeExe = p
  } catch {} // 처음 실행이면 state가 없다.
}
const useClaude = (p) => (dirs.claudeExe = p)

// git이 받은 .git/objects 파일은 읽기 전용이라 그대로는 지워지지 않는다(EPERM). 읽기 전용을 풀고 지운다. (설정 저장소 임시 폴더용)
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

function prepareSession() {
  for (const d of [dirs.bin, dirs.config, dirs.logs, dirs.tmp, dirs.CACHE]) fs.mkdirSync(d, { recursive: true })
}

module.exports = { dirs, init, useClaude, prepareSession, forceRemove }
