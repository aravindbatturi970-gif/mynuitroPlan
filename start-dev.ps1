function Start-ViteDev {
    $psi = Start-Process -FilePath "C:\Users\hp\Documents\web\nutriplan-app\node_modules\.bin\vite.cmd" -ArgumentList "--config","nutriplan-app/vite.config.ts","--host","0.0.0.0","--port","5173" -WorkingDirectory "C:\Users\hp\Documents\web" -NoNewWindow -PassThru -RedirectStandardOutput "nutriplan-app\dev.log" -RedirectStandardError "nutriplan-app\dev.err.log"
    Write-Output "vite pid = $($psi.Id)"
}
Start-ViteDev
