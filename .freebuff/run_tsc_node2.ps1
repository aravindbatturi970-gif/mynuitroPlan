Set-Location "C:\Users\hp\Documents\web\nutriplan-app"
$err_log = "tsc-node2-err.log"
$out_log = "tsc-node2-out.log"
$tscPath = "node_modules/typescript/lib/tsc.js"
$proc = Start-Process -FilePath "node.exe" -ArgumentList @($tscPath, "--noEmit") -WorkingDirectory (Get-Location).Path -RedirectStandardOutput $out_log -RedirectStandardError $err_log -NoNewWindow -Wait -PassThru
Write-Host "EXIT=$($proc.ExitCode)"
$stdoutContent = Get-Content $out_log -ErrorAction SilentlyContinue
$stderrContent = Get-Content $err_log -ErrorAction SilentlyContinue
Write-Host "STDOUT_COUNT=$($stdoutContent.Count)"
Write-Host "STDERR_COUNT=$($stderrContent.Count)"
if ($stdoutContent.Count -gt 0) { Write-Host "--- STDOUT ---"; $stdoutContent }
if ($stderrContent.Count -gt 0) { Write-Host "--- STDERR ---"; $stderrContent }
