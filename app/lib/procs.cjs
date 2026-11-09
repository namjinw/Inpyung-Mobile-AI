// 이 앱이 쓰는 claude.exe가 실행 중인지 확인한다. (이름이 아니라 전체 경로로만 판단하고, 종료시키지는 않는다.)
const { execFile } = require('child_process')
const { dirs } = require('./paths.cjs')

const ps = (script, env) =>
  new Promise((resolve) =>
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, ...env }, windowsHide: true, timeout: 20000 }, (_e, out) =>
      resolve((out || '').trim()),
    ),
  )

const FIND = `Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath -ieq $env:CLAUDE_EXE }`

async function sessionPids() {
  const out = await ps(`${FIND} | ForEach-Object { $_.ProcessId }`, { CLAUDE_EXE: dirs.claudeExe })
  return out.split(/\s+/).filter(Boolean).map(Number)
}

module.exports = { sessionPids }
