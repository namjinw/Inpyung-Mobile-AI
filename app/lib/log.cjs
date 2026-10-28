// 화면과 session\logs\app.log에 같이 남기는 로그 (log 폴더가 session 안이라 같이 삭제됨)
const fs = require('fs')
const path = require('path')
const { dirs } = require('./paths.cjs')

let sink = () => {}
const setSink = (fn) => (sink = fn)

function log(msg) {
  const line = `[${new Date().toTimeString().slice(0, 8)}] ${msg}`
  sink(line)
  try {
    if (fs.existsSync(dirs.logs)) fs.appendFileSync(path.join(dirs.logs, 'app.log'), line + '\n')
  } catch {}
}

module.exports = { log, setSink }
