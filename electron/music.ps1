# 音乐侦测：优先读 Windows 系统媒体传输控制（GSMTC）的真实播放状态，
# 读不到时回退"播放器进程是否存在"的旧判据。
# 输出两行：MUSIC:1 / MUSIC:0（状态变化）与 MUSIC:TRACK:标题 - 艺人（切歌时）
$ErrorActionPreference = 'SilentlyContinue'

$players = @('cloudmusic', 'QQMusic', 'Spotify', 'foobar2000', 'KuGou', 'KwMusic', 'MusicFree', 'listen1', 'AppleMusic', 'Music.UI', 'vlc', 'potplayer', 'mpv')

# 尝试加载 WinRT 媒体控制互操作程序集；失败则全程走进程回退
$gsmtc = $false
try {
  [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
  $gsmtc = $true
} catch {
  $gsmtc = $false
}

function Get-GsmtcPlaying {
  try {
    $mgr = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync().GetAwaiter().GetResult()
    if ($null -eq $mgr) { return $null }
    $session = $mgr.GetCurrentSession()
    if ($null -eq $session) { return $false }
    $status = $session.GetPlaybackInfo().PlaybackStatus
    return ($status -eq 'Playing')
  } catch {
    return $null
  }
}

# 当前曲目（标题 - 艺人）；拿不到返回空串
function Get-GsmtcTrack {
  try {
    $mgr = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync().GetAwaiter().GetResult()
    if ($null -eq $mgr) { return '' }
    $session = $mgr.GetCurrentSession()
    if ($null -eq $session) { return '' }
    $props = $session.TryGetMediaPropertiesAsync().GetAwaiter().GetResult()
    if ($null -eq $props) { return '' }
    $title = $props.Title
    $artist = $props.Artist
    if (-not $title) { return '' }
    return $(if ($artist) { "$title - $artist" } else { $title })
  } catch {
    return ''
  }
}

function Test-PlayerRunning {
  return (@(Get-Process -ErrorAction SilentlyContinue | Where-Object { $players -contains $_.ProcessName }).Count -gt 0)
}

$last = ''
$lastTrack = ''
while ($true) {
  $state = if ($gsmtc) { Get-GsmtcPlaying } else { $null }
  if ($null -eq $state) { $state = Test-PlayerRunning }
  $v = if ($state) { '1' } else { '0' }
  if ($v -ne $last) {
    Write-Output "MUSIC:$v"
    $last = $v
  }
  # 曲目只在播放中上报，且做去重：切歌才发一行
  if ($state -and $gsmtc) {
    $track = Get-GsmtcTrack
    if ($track -and $track -ne $lastTrack) {
      Write-Output "MUSIC:TRACK:$track"
    }
    $lastTrack = $track
  }
  # GSMTC 查询很轻，2 秒足够跟上切歌/暂停；进程回退慢一点省 CPU
  Start-Sleep -Seconds $(if ($gsmtc) { 2 } else { 5 })
}
