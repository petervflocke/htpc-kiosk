param (
    [Parameter(Mandatory = $true)]
    [ValidateSet("on", "off")]
    [string]$mode,

    [switch]$VerboseMode
)

function Log($msg) {
    Write-Host "[vpn.ps1] $msg"
}

function Try-Run($scriptBlock, $description) {
    try {
        if ($VerboseMode) { Log "Running: $description" }
        & $scriptBlock
    } catch {
        Log "ERROR during '$description': $_"
        Read-Host "Press ENTER to exit"
        exit 1
    }
}

# Config
$iface = "Ethernet"

$vpnOff = @{
    IPAddress      = "192.168.0.6"
    PrefixLength   = 24
    DefaultGateway = "192.168.0.1"
    DNS            = "8.8.8.8"
}

$vpnOn = @{
    IPAddress      = "192.168.8.6"
    PrefixLength   = 24
    DefaultGateway = "192.168.8.1"
    DNS            = "8.8.8.8"
}

$config = if ($mode -eq "on") { $vpnOn } else { $vpnOff }

Log "Switching VPN '$mode' on interface '$iface'..."

Try-Run { Get-NetIPAddress -InterfaceAlias $iface -AddressFamily IPv4 -ErrorAction SilentlyContinue |
          Remove-NetIPAddress -Confirm:$false -ErrorAction SilentlyContinue } "Removing existing IPv4 addresses"

Try-Run { Remove-NetRoute -InterfaceAlias $iface -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue } "Removing old IPv4 routes (gateways)"

Try-Run { New-NetIPAddress -InterfaceAlias $iface `
                            -IPAddress $config.IPAddress `
                            -PrefixLength $config.PrefixLength `
                            -DefaultGateway $config.DefaultGateway `
                            -AddressFamily IPv4 `
                            -PolicyStore ActiveStore `
                            -Type Unicast } "Setting new IP: $($config.IPAddress)/$($config.PrefixLength)"


Try-Run { Set-DnsClientServerAddress -InterfaceAlias $iface -ServerAddresses $config.DNS } "Setting DNS: $($config.DNS)"
