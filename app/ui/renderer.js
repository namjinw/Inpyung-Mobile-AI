// 화면 로직 (Vanilla JS). 모든 PC 작업은 preload가 공개한 window.api로만 요청한다.
// 폴더 이름처럼 사용자가 정한 글자는 innerHTML에 넣지 않고 textContent로만 넣는다.
const $ = (id) => document.getElementById(id)
const el = (tag, cls, text) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

let info = {}
let folders = []
let selected = '' // 선택한 작업 폴더 경로
let mode = 'continue' // 'continue'(이어서) | 'new'(새 대화)
let envResult = null
let phase = 'idle'
let page = 'home'

// ── 알림과 확인 창 (alert/confirm 대신 앱 안에서 보여준다)
let toastTimer = null
function toast(msg, ok = false) {
  const t = $('toast')
  t.textContent = msg
  t.className = ok ? 'info' : ''
  t.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (t.hidden = true), 5000)
}
function askBox(msg) {
  return new Promise((resolve) => {
    $('askMsg').textContent = msg
    $('ask').hidden = false
    const done = (v) => {
      $('ask').hidden = true
      $('askYes').onclick = $('askNo').onclick = null
      resolve(v)
    }
    $('askYes').onclick = () => done(true)
    $('askNo').onclick = () => done(false)
    $('askYes').focus()
  })
}

// ── 시간 표시: 오늘 14:02 / 어제 18:42 / 11월 23일
function when(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(new Date()) - day(d)) / 86400000)
  if (diff === 0) return `오늘 ${t}`
  if (diff === 1) return `어제 ${t}`
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

// ── 화면 전환: 설치 전에는 첫 설치 화면, 설치 후에는 본 화면
const SETUP = { idle: '설치 시작', failed: '다시 시도', installing: '설치 중…' }
function setPhase(p) {
  phase = p
  const inSetup = p in SETUP
  document.body.dataset.view = inSetup ? 'setup' : 'home'
  if (inSetup) {
    $('install').textContent = SETUP[p]
    $('install').disabled = p === 'installing'
    $('setupNote').textContent = p === 'failed' ? '실패한 단계를 확인하고 다시 시도해 주세요.' : '설치가 끝나면 홈으로 이동해요.'
  } else {
    renderHome()
  }
}

function showPage(name) {
  page = name
  document.querySelectorAll('.page').forEach((p) => (p.hidden = p.id !== 'page-' + name))
  document.querySelectorAll('#side .nv').forEach((b) => b.classList.toggle('on', b.dataset.page === name))
  document.querySelectorAll('#projects .proj').forEach((b) => b.classList.toggle('on', name === 'home' && b.dataset.path === selected))
  if (name === 'settings') trimLog()
}
document.querySelectorAll('#side .nv').forEach((b) => b.addEventListener('click', () => showPage(b.dataset.page)))
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => showPage(b.dataset.go)))

// ── 작업 폴더 목록 (왼쪽)
async function loadFolders() {
  folders = await window.api.folders()
  if (!folders.some((f) => f.path === selected)) selected = folders[0]?.path || ''
  renderSide()
  renderHome()
}
const current = () => folders.find((f) => f.path === selected) || folders[0]

function renderSide() {
  const box = $('projects')
  box.replaceChildren()
  for (const f of folders) {
    const b = el('button', 'proj' + (page === 'home' && f.path === selected ? ' on' : ''))
    b.dataset.path = f.path
    b.title = f.path
    const name = el('b')
    name.append(el('i', 'd ' + (f.exists ? 'ok' : 'fail')), el('span', '', f.name))
    b.append(name, el('small', '', f.chats ? `${when(f.last)} · 대화 ${f.chats}개` : '대화 없음'))
    if (!f.isDefault) {
      const x = el('span', 'x', '✕')
      x.title = '목록에서 빼기 (폴더는 지워지지 않아요)'
      x.addEventListener('click', async (e) => {
        e.stopPropagation()
        if (!(await askBox(`"${f.name}"을(를) 목록에서 뺄까요?\n폴더와 안의 파일은 지워지지 않아요.`))) return
        await window.api.removeFolder(f.path)
        loadFolders()
      })
      b.append(x)
    }
    b.addEventListener('click', () => {
      selected = f.path
      mode = f.chats ? 'continue' : 'new'
      showPage('home')
      renderHome()
    })
    box.append(b)
  }
}

// ── 홈
function renderHome() {
  const f = current()
  if (!f) return
  $('hName').textContent = f.name
  $('hPath').textContent = f.path
  $('heroTitle').textContent = `${f.name}에서 시작해요`
  $('heroSub').textContent = !f.exists ? '이 폴더는 처음 세션을 열 때 만들어져요.' : f.chats ? `마지막 대화는 ${when(f.last)}에 있어요. 대화 ${f.chats}개.` : '아직 이 폴더에서 나눈 대화가 없어요.'

  const needLogin = phase === 'login' || phase === 'loggingin'
  $('loginBox').hidden = !needLogin
  $('launchBox').hidden = needLogin
  $('loginBtn').disabled = phase === 'loggingin'
  $('loginBtn').textContent = phase === 'loggingin' ? '로그인 중… (브라우저에서 진행하세요)' : '로그인'

  if (!f.chats) mode = 'new'
  document.querySelectorAll('#mode button').forEach((b) => {
    b.classList.toggle('on', b.dataset.mode === mode)
    if (b.dataset.mode === 'continue') b.disabled = !f.chats
  })
  $('modeHint').textContent = mode === 'continue' ? '마지막 대화를 이어서 시작해요. 이미 열린 Claude Code 창이 있으면 새 대화로 열려요.' : info.problemDir ? '새 대화로 시작해요. 문제 폴더를 함께 열고 문제 파일을 먼저 읽게 해요.' : '빈 대화로 시작해요.'
  $('probPath').textContent = info.problemDir || '아직 정하지 않았어요'
  $('probClear').hidden = !info.problemDir
  $('probPick').textContent = info.problemDir ? '바꾸기' : '폴더 선택'
  $('launchBtn').textContent = phase === 'running' ? '세션 하나 더 열기 ▶' : '세션 열기 ▶'

  // 이 폴더의 대화 기록 (최근 5개)
  const hist = $('hist')
  hist.replaceChildren()
  window.api.chats(f.path).then((list) => {
    if (f.path !== selected) return
    hist.replaceChildren()
    if (!list.length) hist.append(el('div', 'r mu', '아직 기록이 없어요.'))
    for (const ms of list.slice(0, 5)) {
      const r = el('div', 'r')
      r.append(el('i', 'd'), el('span', '', when(ms)), el('span', 'mu', '대화'))
      hist.append(r)
    }
  })

  $('sumSet').textContent = ''
  if (info.placeholder) $('sumSet').append(el('i', 'd warn'), el('span', '', '설정 저장소가 아직 정해지지 않았어요'))
  else $('sumSet').append(el('i', 'd ok'), el('span', '', `${info.tag || ''} 적용됨`))
  renderEnvSummary()
}

async function startSession(m) {
  const f = current()
  if (!f) return
  if (phase === 'login' || phase === 'loggingin') return toast('먼저 로그인해 주세요.')
  const r = await window.api.launch({ folder: f.path, mode: m })
  if (!r.ok) return toast(r.error)
  toast('Claude Code 창을 열었어요.', true)
  setTimeout(loadFolders, 2500) // 새 대화 기록이 생기면 목록에 반영한다.
}
$('launchBtn').addEventListener('click', () => startSession(mode))
$('newSession').addEventListener('click', () => {
  mode = 'new'
  showPage('home')
  startSession('new')
})
document.querySelectorAll('#mode button').forEach((b) =>
  b.addEventListener('click', () => {
    mode = b.dataset.mode
    renderHome()
  }),
)
$('loginBtn').addEventListener('click', async () => {
  const r = await window.api.login()
  if (!r.ok) toast(r.error)
})
$('addFolder').addEventListener('click', async () => {
  const r = await window.api.addFolder()
  if (r.error) return toast(r.error)
  if (!r.ok) return
  selected = r.path
  await loadFolders()
  mode = current()?.chats ? 'continue' : 'new'
  showPage('home')
  renderHome()
})
$('probPick').addEventListener('click', async () => {
  const r = await window.api.setProblem('pick')
  if (r.error) return toast(r.error)
  if (!r.ok) return
  info.problemDir = r.path
  renderHome()
})
$('probClear').addEventListener('click', async () => {
  const r = await window.api.setProblem('clear')
  if (!r.ok) return toast(r.error || '해제하지 못했어요.')
  info.problemDir = ''
  renderHome()
})
$('openExplorer').addEventListener('click', async () => {
  const f = current()
  const r = await window.api.openFolder(f.path)
  if (!r.ok) toast(r.error || '폴더를 열지 못했어요. 아직 만들어지지 않았을 수 있어요.')
})

// ── 대회 환경
const ORDER = { fail: 0, warn: 1, ok: 2 }
const STATUS = { fail: '문제', warn: '주의', ok: '정상' }
function count(s) {
  return envResult ? envResult.items.filter((i) => i.status === s).length : 0
}
function renderEnvSummary() {
  const chip = $('envChip')
  const bad = count('fail'), warn = count('warn')
  chip.hidden = !(bad + warn)
  chip.textContent = bad + warn
  chip.className = 'chip sp ' + (bad ? 'fail' : 'warn')
  const s = $('sumEnv')
  s.replaceChildren()
  if (!envResult) return s.append(el('span', 'mu', '점검하는 중…'))
  s.append(el('i', 'd ' + (bad ? 'fail' : warn ? 'warn' : 'ok')), el('span', '', bad || warn ? `문제 ${bad} · 주의 ${warn}` : '모두 정상이에요'))
}
function renderEnv() {
  const list = $('envList')
  list.replaceChildren()
  if (!envResult) return
  $('envSum').textContent = `문제 ${count('fail')} · 주의 ${count('warn')} · 정상 ${count('ok')}  ·  마지막 점검 ${when(Date.now())}`
  const items = [...envResult.items].sort((a, b) => ORDER[a.status] - ORDER[b.status])
  for (const i of items.filter((x) => x.status !== 'ok')) {
    const c = el('div', 'card ' + i.status)
    const h = el('div', 'head')
    h.append(el('i', 'd ' + i.status), el('b', '', i.label), el('span', 'chip sp ' + i.status, STATUS[i.status]))
    c.append(h, el('p', '', i.detail))
    list.append(c)
  }
  const oks = items.filter((x) => x.status === 'ok')
  if (oks.length) {
    const d = el('details', 'card okbox')
    const s = el('summary')
    s.append(el('i', 'd ok'), el('b', '', `정상 ${oks.length}개`), el('span', 'mu sp', '펼치기 ▾'))
    const box = el('div', 'items')
    for (const i of oks) {
      const r = el('div')
      r.append(el('span', '', i.label), el('span', '', i.detail))
      box.append(r)
    }
    d.append(s, box)
    list.append(d)
  }
}
async function loadEnv() {
  $('envSum').textContent = '점검하는 중…'
  envResult = await window.api.check()
  renderEnv()
  renderEnvSummary()
}
$('recheck').addEventListener('click', loadEnv)

// ── 설치 단계 표시
const BADGE = { running: '진행 중', done: '완료', skipped: '건너뜀', failed: '실패' }
function showStep(s) {
  const e = document.querySelector(`.step[data-i="${s.index}"]`)
  if (!e) return
  e.className = 'step ' + s.status
  e.querySelector('.c').textContent = s.status === 'done' ? '✓' : s.status === 'failed' ? '!' : String(s.index)
  e.querySelector('.badge').textContent = BADGE[s.status] || '대기'
  e.querySelector('.bar i').style.width = (s.status === 'done' || s.status === 'skipped' ? 100 : s.pct) + '%'
  if (s.msg) e.querySelector('.msg').textContent = s.msg
}
function resetSteps() {
  document.querySelectorAll('.step').forEach((e, n) => {
    e.className = 'step'
    e.querySelector('.c').textContent = String(n + 1)
    e.querySelector('.badge').textContent = '대기'
    e.querySelector('.bar i').style.width = '0'
  })
}
async function runInstall() {
  resetSteps()
  setPhase('installing')
  const r = await window.api.install()
  if (!r.ok) setPhase('failed')
}
$('install').addEventListener('click', runInstall)
async function reinstall() {
  if (phase === 'installing' || phase === 'loggingin') return
  if (!(await askBox('설정 저장소에서 팀 설정을 다시 받아 적용할까요?\n로그인과 대화 기록은 그대로 두고, 설정 파일만 새 버전으로 바뀌어요.'))) return
  runInstall()
}
$('reinstall').addEventListener('click', reinstall)
$('sumReinstall').addEventListener('click', reinstall)

// ── 메인에서 오는 알림
window.api.onStep(showStep)
window.api.onState((s) => {
  if (s.phase === 'idle' && s.failed) return setPhase('failed')
  const was = phase
  setPhase(s.phase)
  if (s.phase === 'ready' || s.phase === 'running') loadFolders()
  if (was === 'installing' && (s.phase === 'ready' || s.phase === 'login')) loadEnv()
})

// ── 로그: 스크롤 대신 화면에 들어가는 줄 수만큼 최근 기록만 보여준다.
const lines = []
function trimLog() {
  const box = $('log')
  const rows = Math.max(3, Math.floor((box.clientHeight - 24) / 18))
  box.textContent = lines.slice(-rows).join('\n')
}
window.api.onLog((line) => {
  lines.push(line)
  if (lines.length > 500) lines.shift()
  if (page === 'settings') trimLog()
})
window.addEventListener('resize', trimLog)

// ── 설정 적용 확인 창 (목록은 앞쪽만 보여준다)
window.api.onConfirmSettings((p) => {
  const MAX = 10
  $('modalRepo').textContent = `${p.repo} (${p.tag})`
  $('modalFiles').replaceChildren()
  for (const f of p.files.slice(0, MAX)) $('modalFiles').append(el('li', '', f))
  const more = p.files.length - MAX
  const extra = [more > 0 ? `외 ${more}개 파일도 적용돼요.` : '', p.ignored ? `그 밖의 ${p.ignored}개 파일은 적용하지 않아요.` : ''].filter(Boolean)
  $('modalIgnored').textContent = extra.join(' ')
  // 작업 요약을 서버로 보내는 명령이 들어 있으면 적용 전에 한 번 더 알린다.
  $('modalWarn').hidden = !p.files.includes('commands/report.md')
  $('modalWarn').textContent = '이 설정에는 /report 명령이 있어요. 실행하면 작업 요약과 Git 커밋 기록, Claude에게 한 질문, 파일 변동 목록이 서버로 전송돼요. (실행하지 않으면 전송되지 않아요.)'
  $('modalPreview').textContent = (p.claudeMd || '(CLAUDE.md가 없어요.)').split('\n').slice(0, 11).join('\n')
  $('modal').hidden = false
})
const reply = (ok) => {
  $('modal').hidden = true
  window.api.settingsReply(ok)
}
$('ok').addEventListener('click', () => reply(true))
$('skip').addEventListener('click', () => reply(false))

// ── 시작
;(async () => {
  info = await window.api.info()
  $('ver').textContent = `앱 v${info.version}${info.tag ? ` · 설정 ${info.tag}` : ''}`
  $('setRepo').textContent = info.placeholder ? '설정 저장소가 아직 정해지지 않았어요. (app/config.json에서 설정)' : `${info.repo} (${info.tag})`
  setPhase(info.ready ? (info.loggedIn ? 'ready' : 'login') : 'idle')
  showPage('home')
  await loadFolders()
  loadEnv()
})()
