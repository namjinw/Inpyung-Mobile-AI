// .env 파일에서 설정 저장소 주소와 태그를 읽어 config.json 값을 덮어쓴다. (비밀 값은 넣지 않는다.)
// 위치: 배포한 exe 옆 → 프로젝트 맨 위 순서로 처음 찾은 파일 하나만 쓴다.
const fs = require('fs')
const path = require('path')

const candidates = () => [path.join(path.dirname(process.execPath), '.env'), path.join(__dirname, '..', '..', '.env')]

function parse(text) {
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

function load(cfg) {
  const file = candidates().find((f) => fs.existsSync(f))
  const vars = { ...(file ? parse(fs.readFileSync(file, 'utf8')) : {}) }
  for (const k of ['SETTINGS_REPO', 'SETTINGS_TAG']) if (process.env[k]) vars[k] = process.env[k]
  if (vars.SETTINGS_REPO) cfg.settingsRepo = vars.SETTINGS_REPO
  if (vars.SETTINGS_TAG) cfg.settingsTag = vars.SETTINGS_TAG
  return cfg
}

module.exports = { load, parse }
