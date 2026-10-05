# 桌面小仙 · 闭关守护（专注模式）
# 每 3 秒读取一次前台窗口进程名：不在白名单 → 输出 DISTRACT:<进程名>
# Strict=1 时顺带把违规窗口最小化（SW_MINIMIZE）
param(
  [string]$Whitelist = '',
  [string]$Strict = '0'
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -Name U32Guard -Namespace WGuard -MemberDefinition @'
[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint pid);
[DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr h, int cmd);
'@

$wl = @{}
foreach ($n in $Whitelist.Split(',')) {
  $t = $n.Trim()
  if ($t) { $wl[$t.ToLower()] = $true }
}

$last = ''
while ($true) {
  try {
    $h = [WGuard.U32Guard]::GetForegroundWindow()
    if ($h -ne [System.IntPtr]::Zero) {
      $procId = [uint32]0
      [void][WGuard.U32Guard]::GetWindowThreadProcessId($h, [ref]$procId)
      $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
      if ($p) {
        $name = $p.ProcessName.ToLower()
        if (-not $wl.ContainsKey($name)) {
          if ($name -ne $last) {
            Write-Output "DISTRACT:$($p.ProcessName)"
            $last = $name
          }
          if ($Strict -eq '1') {
            [void][WGuard.U32Guard]::ShowWindow($h, 6) # SW_MINIMIZE
            Start-Sleep -Milliseconds 800
          }
        } else {
          $last = ''
        }
      }
    }
  } catch { }
  Start-Sleep -Seconds 3
}
