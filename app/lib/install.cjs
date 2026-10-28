// [F3][F4][F10] Claude Code와 Git을 전용 폴더에만 설치한다.
// 공식 설치 스크립트의 마지막 단계(claude install)는 홈 폴더를 건드리므로 쓰지 않고, 바이너리만 받아서 직접 배치한다.
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')
const { dirs } = require('./paths.cjs')
const { fetchText, sha256File, download } = require('./net.cjs')
const { buildEnv } = require('./env.cjs')
const { log } = require('./log.cjs')

const BASE = 'https://downloads.claude.ai/claude-code-releases'
const mb = (n) => (n / 1024 / 1024).toFixed(0)

// 최신 버전과 공식 체크섬 조회 (다운로드는 하지 않음)
async function resolveClaude() {
  const ver = (await fetchText(`${BASE}/latest`)).trim()
  if (!/^\d+\.\d+\.\d+/.test(ver)) throw new Error('최신 버전 정보를 받지 못했어요. 인터넷 연결이나 지역 제한을 확인해 주세요.')
  const platform = process.arch === 'arm64' ? 'win32-arm64' : 'win32-x64'
  const manifest = JSON.parse(await fetchText(`${BASE}/${ver}/manifest.json`))
  const sum = manifest.platforms && manifest.platforms[platform] && manifest.platforms[platform].checksum
  if (!sum) throw new Error('이 PC에 맞는 설치 파일 정보를 찾지 못했어요.')
  return { ver, platform, sum, url: `${BASE}/${ver}/${platform}/claude.exe` }
}

const run = (file, args, env, ms = 20000) =>
  new Promise((resolve, reject) => execFile(file, args, { env, timeout: ms, windowsHide: true }, (e, out) => (e ? reject(e) : resolve(String(out).trim()))))

// onP(퍼센트, 메시지)
async function claude(cfg, onP) {
  const r = await resolveClaude()
  log(`Claude Code ${r.ver} (${r.platform}) 설치를 시작해요.`)
  const cached = path.join(dirs.CACHE, `claude-${r.ver}-${r.platform}.exe`)

  let hit = false
  if (cfg.useCache && fs.existsSync(cached)) {
    onP(5, '저장해 둔 설치 파일을 확인하는 중…')
    hit = (await sha256File(cached)) === r.sum
    if (!hit) fs.rmSync(cached, { force: true })
  }
  if (hit) log('저장해 둔 설치 파일을 사용해요.')
  else await download(r.url, cached, { sha256: r.sum, onProgress: (g, t) => onP(t ? Math.round((g / t) * 90) : 0, `${mb(g)} / ${t ? mb(t) : '?'} MB 내려받는 중…`) })

  fs.mkdirSync(dirs.bin, { recursive: true })
  fs.copyFileSync(cached, dirs.claudeExe)
  if (!cfg.useCache) fs.rmSync(cached, { force: true })

  onP(95, '설치된 파일을 확인하는 중…')
  const version = await run(dirs.claudeExe, ['--version'], buildEnv(null)).catch(() => {
    throw new Error('설치한 Claude Code가 실행되지 않아요. 백신이 막았는지 확인한 뒤 다시 시도해 주세요.')
  })
  log(`설치 확인: ${version}`)
  return { version }
}

// 시스템에 Git이 있으면 그걸 쓰고, 없으면 휴대용 Git을 전용 폴더에 푼다.
function findSystemBash() {
  const cands = ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe', path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe')]
  return cands.find((p) => fs.existsSync(p)) || null
}

async function git(cfg, onP) {
  const sys = findSystemBash()
  if (sys) {
    log(`시스템에 설치된 Git을 사용해요: ${sys}`)
    const exe = path.join(path.dirname(path.dirname(sys)), 'cmd', 'git.exe')
    return { mode: 'system', bashPath: sys, gitExe: fs.existsSync(exe) ? exe : 'git' } // PATH에 없는 위치일 수 있어서 경로를 직접 알려준다.
  }
  const file = path.join(dirs.CACHE, cfg.gitFile)
  let hit = false
  if (fs.existsSync(file)) hit = (await sha256File(file)) === cfg.gitSha256.toLowerCase()
  if (!hit) {
    fs.rmSync(file, { force: true })
    await download(`https://github.com/git-for-windows/git/releases/download/${cfg.gitTag}/${cfg.gitFile}`, file, {
      sha256: cfg.gitSha256,
      onProgress: (g, t) => onP(t ? Math.round((g / t) * 70) : 0, `${mb(g)} / ${t ? mb(t) : '?'} MB 내려받는 중…`),
    })
  }
  onP(75, '휴대용 Git을 푸는 중…')
  fs.mkdirSync(dirs.git, { recursive: true })
  await run(file, ['-y', `-o${dirs.git}`], process.env, 300000).catch(() => {
    throw new Error('휴대용 Git을 풀지 못했어요. 디스크 여유 공간을 확인한 뒤 다시 시도해 주세요.')
  })
  const bash = path.join(dirs.git, 'bin', 'bash.exe')
  if (!fs.existsSync(bash)) throw new Error('휴대용 Git에서 bash를 찾지 못했어요. 다시 시도해 주세요.')
  const exe = path.join(dirs.git, 'cmd', 'git.exe')
  if (!fs.existsSync(exe)) throw new Error('휴대용 Git에서 git 실행 파일을 찾지 못했어요. 다시 시도해 주세요.')
  log(`휴대용 Git 준비 완료: ${bash}`)
  return { mode: 'portable', bashPath: bash, gitExe: exe }
}

module.exports = { resolveClaude, claude, git, findSystemBash }
