// [F2] 환경 점검: OS, 디스크, 인터넷, 과금 환경변수. 환경변수는 경고만 하고 값은 건드리지 않는다.
const fs = require('fs')
const os = require('os')
const { dirs } = require('./paths.cjs')
const { fetchText } = require('./net.cjs')
const { BILLING_VARS } = require('./env.cjs')

async function run(cfg) {
  const items = []
  const add = (id, label, status, detail) => items.push({ id, label, status, detail })

  // ① OS
  const major = Number(os.release().split('.')[0])
  if (process.platform === 'win32' && major >= 10) add('os', '운영체제', 'ok', `Windows ${major >= 10 ? '10/11' : ''} (${os.release()})`)
  else add('os', '운영체제', 'fail', 'Windows 10 이상에서만 쓸 수 있어요.')

  // ② 디스크 여유
  try {
    const s = fs.statfsSync(process.env.LOCALAPPDATA || os.homedir())
    const gb = (s.bavail * s.bsize) / 1024 ** 3
    if (gb >= cfg.minFreeGB) add('disk', '디스크 여유', 'ok', `${gb.toFixed(1)}GB 남아 있어요.`)
    else add('disk', '디스크 여유', 'fail', `${gb.toFixed(1)}GB만 남아 있어요. 최소 ${cfg.minFreeGB}GB가 필요해서 공간을 먼저 확보해 주세요.`)
  } catch {
    add('disk', '디스크 여유', 'warn', '남은 공간을 확인하지 못했어요. 설치는 계속 시도할게요.')
  }

  // ③ 인터넷
  try {
    await fetchText('https://downloads.claude.ai/claude-code-releases/latest', 8000)
    add('net', '인터넷 연결', 'ok', '설치 서버에 연결할 수 있어요.')
  } catch {
    add('net', '인터넷 연결', 'fail', '설치 서버에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.')
  }

  // ④ 과금 환경변수 (경고만)
  const found = BILLING_VARS.filter((k) => process.env[k])
  if (found.length) add('env', '환경변수', 'warn', `${found.join(', ')} 값이 설정돼 있어요. API 과금이 될 수 있어서 이 앱에서 실행할 때는 이 값을 쓰지 않아요. (설정한 값은 바꾸지 않아요.)`)
  else add('env', '환경변수', 'ok', 'API 과금과 관련된 환경변수가 없어요.')

  const fail = items.find((i) => i.status === 'fail')
  return { items, blocking: !!fail, blockMsg: fail ? fail.detail : '' }
}

module.exports = { run }
