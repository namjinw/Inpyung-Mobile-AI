// 전용 폴더 안의 프로그램만 찾아서 종료한다. (이름으로 죽이면 내 실제 claude까지 죽으므로 경로로만 판단)
const { execFile } = require('child_process')
const path = require('path')
const { dirs } = require('./paths.cjs')

const ps = (script, env) =>
  new Promise((resolve) =>
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, ...env }, windowsHide: true, timeout: 20000 }, (_e, out) =>
      resolve((out || '').trim()),
    ),
  )

// ExecutablePath가 SESSION 폴더 아래인 프로세스
const FIND = `Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($env:SESS_DIR, [StringComparison]::OrdinalIgnoreCase) }`
const env = () => ({ SESS_DIR: dirs.SESSION + path.sep })

async function sessionPids() {
  const out = await ps(`${FIND} | ForEach-Object { $_.ProcessId }`, env())
  return out.split(/\s+/).filter(Boolean).map(Number)
}

async function killSessionProcs() {
  const out = await ps(`${FIND} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $_.ProcessId }`, env())
  return out.split(/\s+/).filter(Boolean).length
}

module.exports = { sessionPids, killSessionProcs }
