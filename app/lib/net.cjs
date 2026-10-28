// 다운로드 도구: 스트리밍 저장 + SHA256 검증 (300MB라서 메모리에 올리지 않는다)
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { Readable } = require('stream')
const { pipeline } = require('stream/promises')

const UA = { 'User-Agent': 'claude-contest-tool' }

async function fetchText(url, ms = 15000) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(`서버 응답이 올바르지 않아요. (HTTP ${res.status}) ${url}`)
  return res.text()
}

async function sha256File(file) {
  const h = crypto.createHash('sha256')
  await pipeline(fs.createReadStream(file), h)
  return h.digest('hex')
}

// onProgress(받은 바이트, 전체 바이트)
async function download(url, dest, { sha256, onProgress } = {}) {
  const res = await fetch(url, { headers: UA, redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`파일을 내려받지 못했어요. (HTTP ${res.status}) 인터넷 연결을 확인해 주세요.`)
  const total = Number(res.headers.get('content-length')) || 0
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const part = dest + '.part'
  const hash = crypto.createHash('sha256')
  let got = 0
  const src = Readable.fromWeb(res.body)
  src.on('data', (c) => {
    hash.update(c)
    got += c.length
    onProgress && onProgress(got, total)
  })
  try {
    await pipeline(src, fs.createWriteStream(part))
  } catch (e) {
    fs.rmSync(part, { force: true })
    throw new Error(`내려받는 중 연결이 끊겼어요. 다시 시도해 주세요. (${e.code || e.message})`)
  }
  const actual = hash.digest('hex')
  if (sha256 && actual !== sha256.toLowerCase()) {
    fs.rmSync(part, { force: true })
    throw new Error('내려받은 파일이 공식 파일과 달라서 사용하지 않았어요. 잠시 후 다시 시도해 주세요.')
  }
  fs.renameSync(part, dest)
  return actual
}

module.exports = { fetchText, sha256File, download }
