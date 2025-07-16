Start-Process "npx" "electron", ".", "--enable-logging" -NoNewWindow -Wait
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start the application. Please check the logs for more details."
} else {
    Write-Host "Application started successfully."
}