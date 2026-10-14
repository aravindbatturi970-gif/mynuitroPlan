Set-Location "C:\Users\hp\Documents\web\nutriplan-app"
$tscPath = "node_modules/typescript/lib/tsc.js"
$err_log = "tsc-node-err.log"
$out_log = "tsc-node-out.log"
$proc = Start-Process -FilePath "node.exe" -ArgumentList @($tscPath, "--noEmit") -WorkingDirectory (Get-Location).Path -RedirectStandardOutput $out_log -RedirectStandardError $err_log -NoNewWindow -Wait -PassThru
Write-Host "EXIT=$($proc.ExitCode)"
Get-Content $out_log -ErrorAction SilentlyContinue
Write-Host "---ERR---"
Get-Content $err_log -ErrorAction SilentlyContinue
