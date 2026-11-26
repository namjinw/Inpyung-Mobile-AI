// 실행할 claude에게 줄 환경변수. 이 프로세스 안에서만 쓰고 시스템 환경변수는 건드리지 않는다.
const fs = require('fs')
const path = require('path')
const { dirs } = require('./paths.cjs')

const BILLING_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']

// 안드로이드 SDK의 도구 폴더(adb, emulator, aapt). PC의 Path에 등록돼 있지 않아도 /grading이 쓸 수 있게 직접 찾는다.
function androidToolDirs(env) {
  const roots = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT, env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Android', 'Sdk')]
  const sdk = roots.find((r) => r && fs.existsSync(path.join(r, 'platform-tools')))
  if (!sdk) return []
  const found = [path.join(sdk, 'platform-tools'), path.join(sdk, 'emulator')]
  try {
    const versions = fs.readdirSync(path.join(sdk, 'build-tools')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    if (versions.length) found.push(path.join(sdk, 'build-tools', versions[versions.length - 1]))
  } catch {} // build-tools가 없으면 aapt 없이 쓴다.
  return found.filter((d) => fs.existsSync(d))
}

// winget으로 설치한 ffmpeg(영상 채점용). 설치 직후에는 Path에 반영되지 않을 수 있어 직접 찾는다.
function ffmpegDirs(env) {
  const base = env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages')
  const subdirs = (d) => {
    try {
      return fs.readdirSync(d).map((n) => path.join(d, n))
    } catch {
      return [] // 설치돼 있지 않으면 없다.
    }
  }
  return base
    ? subdirs(base)
        .filter((d) => path.basename(d).startsWith('Gyan.FFmpeg'))
        .flatMap(subdirs)
        .map((d) => path.join(d, 'bin'))
        .filter((d) => fs.existsSync(path.join(d, 'ffmpeg.exe')))
    : []
}

function buildEnv(bashPath) {
  const env = { ...process.env }
  for (const k of Object.keys(env)) {
    // 다른 claude 세션이 남긴 값, 우회 연결(Bedrock 등) 설정은 모두 지운다.
    if (k === 'CLAUDECODE' || k === 'CLAUDE_CONFIG_DIR' || k.startsWith('CLAUDE_CODE_')) delete env[k]
  }
  for (const k of BILLING_VARS) delete env[k] // API 과금 방지: 값은 그대로 두고 이 실행에서만 뺀다.
  env.CLAUDE_CONFIG_DIR = dirs.config // 설정과 로그인 정보를 전용 폴더에 저장
  env.DISABLE_AUTOUPDATER = '1' // 자동 업데이트가 폴더 밖에 파일을 만들지 않게 함
  if (bashPath) env.CLAUDE_CODE_GIT_BASH_PATH = bashPath
  // Windows의 환경변수 이름은 Path/PATH처럼 대소문자가 제각각이라 있는 이름을 찾아 뒤에 덧붙인다. (원래 있던 도구가 우선)
  const tools = [...androidToolDirs(env), ...ffmpegDirs(env)]
  if (tools.length) {
    const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'Path'
    env[key] = [env[key], ...tools].filter(Boolean).join(path.delimiter)
  }
  return env
}

module.exports = { buildEnv, androidToolDirs, BILLING_VARS }
