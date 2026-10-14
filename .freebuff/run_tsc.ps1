param([string]$logPath = "tsc-check.log")
Set-Location "C:\Users\hp\Documents\web\nutriplan-app"

# Use direct node invocation to avoid cmd wrapper issues
$tscJs = ".\node_modules\typescript\lib\tsc.js"
$nodeArgs = @($tscJs, "--noEmit")

$errLog = "$logPath.err"
$outLog = "$logPath.out"

$proc = Start-Process -FilePath "node.exe" -ArgumentList $nodeArgs -WorkingDirectory (Get-Location).Path -RedirectStandardOutput $outLog -RedirectStandardError $errLog -NoNewWindow -Wait -PassThru

Write-Host "PROC_EXIT=$($proc.ExitCode)"
Write-Host "=== STDOUT ==="
Get-Content $outLog -ErrorAction SilentlyContinue
Write-Host "=== STDERR ==="
Get-Content $errLog -ErrorAction SilentlyContinue
