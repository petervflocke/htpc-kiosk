# This script finds the primary network interface and returns its configuration as JSON.
# The primary interface is identified as the one having an IPv4 default gateway.

try {
    # Find the primary network interface configuration
    $ipconfig = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.InterfaceAlias -notlike "Loopback*" } | Select-Object -First 1

    if ($null -eq $ipconfig) {
        # If no interface with a gateway is found, return a JSON object with an error message.
        $errorOutput = @{ error = "Could not find an active network interface with a default gateway." }
        $errorOutput | ConvertTo-Json -Compress
        exit 0 # Exit gracefully so Electron can parse the error JSON
    }

    # Get the full IP address object to find the prefix length
    $ipAddressInfo = Get-NetIPAddress -InterfaceIndex $ipconfig.InterfaceIndex -AddressFamily IPv4 | Select-Object -First 1

    # Get DNS server addresses
    $dnsServers = (Get-DnsClientServerAddress -InterfaceIndex $ipconfig.InterfaceIndex -AddressFamily IPv4).ServerAddresses

    # Construct the output object
    $output = @{
        interfaceAlias = $ipconfig.InterfaceAlias;
        ipAddress = $ipAddressInfo.IPAddress;
        prefixLength = $ipAddressInfo.PrefixLength;
        gateway = $ipconfig.IPv4DefaultGateway.NextHop;
        dns = if ($null -ne $dnsServers) { $dnsServers -join ',' } else { "" }
    }

    # Convert to JSON and write to standard output
    $output | ConvertTo-Json -Compress

} catch {
    # Catch any other unexpected errors
    $errorOutput = @{ error = "An unexpected error occurred: $($_.Exception.Message)" }
    $errorOutput | ConvertTo-Json -Compress
    exit 0
}