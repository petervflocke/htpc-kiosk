param (
    [Parameter(Mandatory = $true)][string]$InterfaceAlias,
    [Parameter(Mandatory = $true)][string]$IPAddress,
    [Parameter(Mandatory = $true)][int]$PrefixLength,
    [Parameter(Mandatory = $true)][string]$Gateway,
    [Parameter(Mandatory = $true)][string]$DNS
)

function Log($msg) {
    Write-Host "[set-network-config.ps1] $msg"
}

Log "Applying network settings to interface '$InterfaceAlias'..."
Log "-> IP: $IPAddress/$PrefixLength, Gateway: $Gateway, DNS: $DNS"

try {
    $iface = Get-NetAdapter -Name $InterfaceAlias
    if (-not $iface) {
        throw "Network interface '$InterfaceAlias' not found."
    }

    # Remove existing IP configuration to avoid conflicts
    Log "Removing existing IP addresses and routes..."
    Get-NetIPAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 -ErrorAction SilentlyContinue | Remove-NetIPAddress -Confirm:$false
    Remove-NetRoute -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue

    # Set new IP Address and Gateway
    Log "Setting new IP address and gateway..."
    New-NetIPAddress -InterfaceAlias $InterfaceAlias -IPAddress $IPAddress -PrefixLength $PrefixLength -DefaultGateway $Gateway

    # Set DNS Servers
    Log "Setting new DNS server addresses..."
    $dnsArray = $DNS.Split(',') | ForEach-Object { $_.Trim() }
    Set-DnsClientServerAddress -InterfaceAlias $InterfaceAlias -ServerAddresses $dnsArray

    Log "Successfully applied network configuration."
    exit 0
} catch {
    Log "ERROR applying network configuration: $_"
    # Write error to stderr for Electron's exec to catch it
    Write-Error $_
    exit 1
}