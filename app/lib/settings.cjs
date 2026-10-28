// [F5][F11] 설정 저장소(비공개 가능)의 릴리스 태그를 git clone으로 받아 CLAUDE_CONFIG_DIR에 적용한다.
// GitHub 로그인은 Git(자격 증명 관리자)이 처리하고, 이 앱은 토큰을 저장하거나 입력받지 않는다.
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')
const { dirs, forceRemove } = require('./paths.cjs')
const { log } = require('./log.cjs')

const CLONE = path.join(dirs.tmp, 'settings-repo')

const isPlaceholder = (cfg) => !cfg.settingsRepo || cfg.settingsRepo === 'OWNER/REPO'

function validate(cfg) {
  const parts = String(cfg.settingsRepo).split('/')
  if (parts.length !== 2 || !parts.every((p) => /^[\w.-]+$/.test(p) && !/^\.+$/.test(p))) throw new Error('설정 저장소 주소 형식이 올바르지 않아요. (예: 조직이름/저장소이름)')
  const tag = String(cfg.settingsTag)
  if (!/^[\w.\-/]+$/.test(tag) || tag.startsWith('-') || tag.split('/').some((p) => /^\.+$/.test(p))) throw new Error('설정 저장소 태그 형식이 올바르지 않아요. (예: v1.0.0)')
  const dir = String(cfg.settingsDir || '')
  if (dir && (!/^[\w.-]+(\/[\w.-]+)*$/.test(dir) || dir.split('/').some((p) => /^\.+$/.test(p) && p !== '.'))) throw new Error('설정 폴더 이름 형식이 올바르지 않아요. (예: .claude)')
}

// 저장소 안에서 설정 파일이 들어 있는 폴더 (비어 있으면 저장소 맨 위)
const base = (cfg) => path.join(CLONE, cfg.settingsDir || '')

// git 오류를 사용자가 이해할 수 있는 문장으로 바꾼다.
function explain(stderr, cfg) {
  if (/Remote branch .* not found|not found in upstream/i.test(stderr)) return `태그(${cfg.settingsTag})를 저장소에서 찾지 못했어요. 릴리스 태그 이름이 맞는지 확인해 주세요.`
  if (/Authentication failed|could not read Username|terminal prompts disabled|Permission denied|403|Repository not found|not found/i.test(stderr))
    return `설정 저장소(${cfg.settingsRepo})에 접근하지 못했어요. 저장소 접근 권한이 있는 계정으로 GitHub 로그인을 마쳤는지, 저장소 이름이 맞는지 확인해 주세요.`
  return `설정 저장소를 받지 못했어요. (${stderr.trim().split(/\r?\n/)[0] || '알 수 없는 오류'})`
}

const git = (gitExe, args, cfg) =>
  new Promise((resolve, reject) =>
    execFile(gitExe, args, { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, windowsHide: true, timeout: 300000, maxBuffer: 20 * 1024 * 1024 }, (e, out, err) =>
      e ? reject(new Error(explain(String(err || e.message), cfg))) : resolve(String(out)),
    ),
  )

// SETTINGS_TAG=latest 이면 저장소의 vX.Y.Z 태그 중 가장 높은 버전을 쓴다.
async function latestTag(cfg, gitExe) {
  const out = await git(gitExe, ['ls-remote', '--tags', '--refs', `https://github.com/${cfg.settingsRepo}.git`], cfg)
  const tags = out
    .split(/\r?\n/)
    .map((l) => l.split('refs/tags/')[1])
    .filter((t) => /^v?\d+\.\d+\.\d+$/.test(t || ''))
    .sort((a, b) => {
      const [x, y] = [a, b].map((t) => t.replace(/^v/, '').split('.').map(Number))
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
    })
  if (!tags.length) throw new Error('설정 저장소에 vX.Y.Z 형식의 태그가 없어요.')
  log(`최신 설정 태그: ${tags[tags.length - 1]}`)
  return tags[tags.length - 1]
}

// 적용할 항목(허용 목록에 있는 최상위 파일/폴더)만 남긴다.
const allowed = (cfg, p) => cfg.settingsFiles.includes(p.split('/')[0])

function listFiles(root, rel = '') {
  const out = []
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (e.name === '.git') continue
    const p = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) out.push(...listFiles(root, p))
    else if (e.isFile()) out.push(p)
  }
  return out
}

// 저장소를 임시 폴더(전용 폴더 안)에 받고, 적용하기 전에 파일 목록과 미리보기를 돌려준다.
async function plan(cfg, gitExe) {
  validate(cfg)
  if (cfg.settingsTag === 'latest') cfg = { ...cfg, settingsTag: await latestTag(cfg, gitExe) }
  forceRemove(CLONE)
  fs.mkdirSync(dirs.tmp, { recursive: true })
  log(`설정 저장소를 받는 중: ${cfg.settingsRepo} (${cfg.settingsTag})`)
  await git(gitExe, ['-c', 'advice.detachedHead=false', '-c', 'core.symlinks=false', '-c', 'core.autocrlf=false', 'clone', '--depth', '1', '--branch', cfg.settingsTag, `https://github.com/${cfg.settingsRepo}.git`, CLONE], cfg)

  const root = base(cfg)
  if (!fs.existsSync(root)) throw new Error(`저장소에 '${cfg.settingsDir}' 폴더가 없어요. 설정 폴더 이름을 확인해 주세요.`)
  const all = listFiles(root)
  const files = all.filter((p) => allowed(cfg, p))
  if (!files.length) throw new Error(`저장소에 적용할 파일이 없어요. (${cfg.settingsFiles.join(', ')} 중 하나는 있어야 해요.)`)
  const read = (f) => (fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), 'utf8').slice(0, 20000) : '')
  return { repo: cfg.settingsRepo, tag: cfg.settingsTag, files, ignored: all.length - files.length, claudeMd: read('CLAUDE.md'), settingsJson: read('settings.json') }
}

// 확인을 받은 뒤 전용 설정 폴더로 복사. 전용 폴더가 새로 시작이라 병합 없이 복사한다.
function apply(cfg, onP) {
  let n = 0
  for (const name of cfg.settingsFiles) {
    const from = path.join(base(cfg), name)
    if (!fs.existsSync(from)) continue
    onP(50 + n * 10, `${name} 적용 중…`)
    fs.cpSync(from, path.join(dirs.config, name), { recursive: true })
    n++
  }
  forceRemove(CLONE)
  log(`설정 ${n}개 항목을 적용했어요.`)
  return { applied: n }
}

// 적용하지 않고 중단할 때 받아 둔 저장소를 지운다.
const cleanup = () => forceRemove(CLONE)

module.exports = { isPlaceholder, plan, apply, cleanup }
