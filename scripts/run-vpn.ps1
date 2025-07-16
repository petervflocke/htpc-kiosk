param([string]$mode = "off", [switch]$VerboseMode)

# Relaunch as admin if not already
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
          ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {

    $script = "`"$PSCommandPath`" $mode"
    if ($VerboseMode) { $script += " -VerboseMode" }

    Start-Process powershell "-NoProfile -ExecutionPolicy Bypass -File $script" -Verb RunAs
    exit
}

# Call vpn.ps1 directly
$vpnArgs = "$mode"
if ($VerboseMode) { $vpnArgs += " -VerboseMode" }

& "$PSScriptRoot\vpn.ps1" $vpnArgs
