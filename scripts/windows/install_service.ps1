# =====================================================================
# AQ COMPANIES — Windows Service & Task Scheduler Installer
# Sets up automatic startup on Windows Server reboot / power-on
# and configures nightly 02:00 AM automated backups.
# Run as Administrator.
# =====================================================================

param (
    [switch]$Uninstall = $false
)

$ErrorActionPreference = "Stop"

# Verify Administrator Privileges
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] This installer must be executed in an elevated PowerShell session (Run as Administrator)." -ForegroundColor Red
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$BackendBat = Join-Path $ScriptDir "start_backend.bat"
$FrontendBat = Join-Path $ScriptDir "start_frontend.bat"
$BackupBat = Join-Path $ScriptDir "backup_nightly.bat"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "AQ COMPANIES — WINDOWS AUTOMATION & SERVICE CONFIGURATION" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Project Root : $ProjectRoot"
Write-Host "Scripts Dir  : $ScriptDir"
Write-Host ""

$BackendTaskName = "AQ_Companies_Backend"
$FrontendTaskName = "AQ_Companies_Frontend"
$BackupTaskName = "AQ_Companies_NightlyBackup"

if ($Uninstall) {
    Write-Host ">> Uninstalling AQ Companies Scheduled Tasks..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $BackendTaskName -Confirm:$false -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $FrontendTaskName -Confirm:$false -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $BackupTaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "[SUCCESS] All AQ Companies scheduled tasks removed." -ForegroundColor Green
    exit 0
}

# 1. Install Backend Task (At system startup, restart on failure)
Write-Host ">> [1/3] Registering Task: $BackendTaskName (At System Startup)..." -ForegroundColor Yellow
$BackendAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$BackendBat`"" -WorkingDirectory (Join-Path $ProjectRoot "backend")
$BackendTrigger = New-ScheduledTaskTrigger -AtStartup
$BackendSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)
Register-ScheduledTask -TaskName $BackendTaskName -Action $BackendAction -Trigger $BackendTrigger -Settings $BackendSettings -User "SYSTEM" -RunLevel Highest -Force | Out-Null
Write-Host "   [SUCCESS] Backend task registered to run as SYSTEM at startup." -ForegroundColor Green

# 2. Install Frontend Task (At system startup, restart on failure)
Write-Host ">> [2/3] Registering Task: $FrontendTaskName (At System Startup)..." -ForegroundColor Yellow
$FrontendAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$FrontendBat`"" -WorkingDirectory (Join-Path $ProjectRoot "frontend")
$FrontendTrigger = New-ScheduledTaskTrigger -AtStartup
$FrontendSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)
Register-ScheduledTask -TaskName $FrontendTaskName -Action $FrontendAction -Trigger $FrontendTrigger -Settings $FrontendSettings -User "SYSTEM" -RunLevel Highest -Force | Out-Null
Write-Host "   [SUCCESS] Frontend task registered to run as SYSTEM at startup." -ForegroundColor Green

# 3. Install Nightly Backup Task (Daily at 02:00 AM)
Write-Host ">> [3/3] Registering Task: $BackupTaskName (Daily at 02:00 AM)..." -ForegroundColor Yellow
$BackupAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$BackupBat`"" -WorkingDirectory (Join-Path $ProjectRoot "backend")
$BackupTrigger = New-ScheduledTaskTrigger -Daily -At "02:00AM"
$BackupSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName $BackupTaskName -Action $BackupAction -Trigger $BackupTrigger -Settings $BackupSettings -User "SYSTEM" -RunLevel Highest -Force | Out-Null
Write-Host "   [SUCCESS] Nightly backup task registered for 02:00 AM daily." -ForegroundColor Green

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "CONFIGURATION COMPLETE!" -ForegroundColor Green
Write-Host "- Backend API:     Auto-starts on server reboot (Port 8000)"
Write-Host "- Frontend Web:    Auto-starts on server reboot (Port 3000)"
Write-Host "- Nightly Backups: Runs daily at 02:00 AM with verification"
Write-Host "======================================================================" -ForegroundColor Cyan
