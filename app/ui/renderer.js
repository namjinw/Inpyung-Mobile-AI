// 화면 로직 (Vanilla JS). 모든 PC 작업은 preload가 공개한 window.api로만 요청한다.
const $ = (id) => document.getElementById(id)
const mainBtn = $('main')

// ① 사이드바: ☰로 열고 닫고, 메뉴로 화면(설치/안내/로그)을 바꾼다.
const TITLES = { install: '설치', guide: '안내', log: '로그' }
$('toggle').addEventListener('click', () => {
  $('app').classList.toggle('closed')
  trimLog() // 폭이 바뀌면 줄 바꿈이 달라져서 다시 맞춘다.
})
document.querySelectorAll('#side nav button').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('#side nav button').forEach((x) => x.classList.toggle('active', x === b))
    document.querySelectorAll('.page').forEach((p) => (p.hidden = p.id !== 'page-' + b.dataset.page))
    $('title').textContent = TITLES[b.dataset.page]
    trimLog()
  }),
)

// ② 버튼은 상태에 따라 설치 → 설치 중 → 실행 → 실행 중으로 바뀐다.
const PHASES = {
  idle: { text: '설치', tag: '대기', disabled: false },
  failed: { text: '다시 시도', tag: '실패', disabled: false },
  installing: { text: '설치 중…', tag: '설치 중', disabled: true },
  ready: { text: '실행', tag: '설치 완료', disabled: false },
  running: { text: '실행 중 (Claude Code 창을 확인하세요)', tag: '실행 중', disabled: true },
}
let phase = 'idle'
function setPhase(p) {
  phase = p
  mainBtn.dataset.phase = p === 'failed' ? 'idle' : p
  mainBtn.textContent = PHASES[p].text
  mainBtn.disabled = PHASES[p].disabled
  $('phaseTag').textContent = PHASES[p].tag
}

// ③ 환경 점검 결과 표시
async function showCheck() {
  const r = await window.api.check()
  $('env').innerHTML = ''
  for (const i of r.items) {
    const li = document.createElement('li')
    const dot = document.createElement('span')
    dot.className = 'dot ' + i.status
    const t = document.createElement('span')
    t.textContent = `${i.label}: ${i.detail}`
    li.append(dot, t)
    $('env').append(li)
  }
}

// ④ 단계 진행 표시 (n/4 이름, 진행 막대, 메시지)
const BADGE = { running: '진행 중', done: '완료', skipped: '건너뜀', failed: '실패' }
function showStep(s) {
  const el = document.querySelector(`.step[data-i="${s.index}"]`)
  if (!el) return
  el.className = 'step ' + s.status
  el.querySelector('.badge').textContent = BADGE[s.status] || '대기'
  el.querySelector('.bar i').style.width = (s.status === 'done' || s.status === 'skipped' ? 100 : s.pct) + '%'
  el.querySelector('.msg').textContent = s.msg || ''
}
function resetSteps() {
  document.querySelectorAll('.step').forEach((el) => {
    el.className = 'step'
    el.querySelector('.badge').textContent = '대기'
    el.querySelector('.bar i').style.width = '0'
    el.querySelector('.msg').textContent = ''
  })
}

// ⑤ 버튼 동작
mainBtn.addEventListener('click', async () => {
  if (phase === 'ready') {
    const l = await window.api.launch()
    if (!l.ok) alert(l.error)
    return
  }
  resetSteps()
  setPhase('installing')
  const r = await window.api.install()
  if (!r.ok) setPhase('failed')
})
$('reset').addEventListener('click', async () => {
  if (!confirm('Claude를 종료하고 로그인 정보와 설치 파일(전용 폴더)을 삭제할까요?\n작업 폴더의 파일은 지우지 않아요.')) return
  const r = await window.api.reset()
  if (!r.ok) alert(r.error || r.err)
  resetSteps()
  showCheck()
})

// ⑥ 메인에서 오는 알림
window.api.onStep(showStep)
window.api.onState((s) => {
  if (s.phase === 'idle' && s.failed) return setPhase('failed')
  setPhase(s.phase)
})

// ⑦ 로그: 스크롤 대신 화면에 들어가는 줄 수만큼 최근 기록만 보여준다.
const lines = []
function trimLog() {
  const box = $('log')
  const rows = Math.max(3, Math.floor((box.clientHeight - 20) / 18))
  box.textContent = lines.slice(-rows).join('\n')
}
window.api.onLog((line) => {
  lines.push(line)
  if (lines.length > 500) lines.shift()
  trimLog()
})
window.addEventListener('resize', trimLog)

// ⑧ [F5][F11] 설정 적용 확인 창 (목록은 앞쪽만 보여준다)
window.api.onConfirmSettings((p) => {
  const MAX = 10
  $('modalRepo').textContent = `${p.repo} (${p.tag})`
  $('modalFiles').innerHTML = ''
  for (const f of p.files.slice(0, MAX)) {
    const li = document.createElement('li')
    li.textContent = f
    $('modalFiles').append(li)
  }
  const more = p.files.length - MAX
  const extra = [more > 0 ? `외 ${more}개 파일도 적용돼요.` : '', p.ignored ? `그 밖의 ${p.ignored}개 파일은 적용하지 않아요.` : ''].filter(Boolean)
  $('modalIgnored').textContent = extra.join(' ')
  // 작업 요약을 서버로 보내는 명령이 들어 있으면 적용 전에 한 번 더 알린다.
  $('modalWarn').hidden = !p.files.includes('commands/report.md')
  $('modalWarn').textContent = '이 설정에는 /report 명령이 있어요. 실행하면 작업 요약이 서버로 전송돼요. (실행하지 않으면 전송되지 않아요.)'
  $('modalPreview').textContent = (p.claudeMd || '(CLAUDE.md가 없어요.)').split('\n').slice(0, 11).join('\n')
  $('modal').hidden = false
})
const reply = (ok) => {
  $('modal').hidden = true
  window.api.settingsReply(ok)
}
$('ok').addEventListener('click', () => reply(true))
$('skip').addEventListener('click', () => reply(false))

// ⑨ 시작
;(async () => {
  const info = await window.api.info()
  $('work').textContent = info.work
  setPhase(info.ready ? 'ready' : 'idle')
  showCheck()
})()
