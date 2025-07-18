# This script finds all physical network adapters (LAN and WLAN) and returns them as a JSON array.

try {
    # Get all network adapters that are physical (not virtual, loopback, etc.)
    $adapters = Get-NetAdapter -Physical | ForEach-Object {
        $adapterType = "Unknown"
        if ($_.PhysicalMediaType -eq "802.3") {
            $adapterType = "LAN (Ethernet)"
        } elseif ($_.PhysicalMediaType -eq "Native 802.11") {
            $adapterType = "WLAN (Wi-Fi)"
        }

        [PSCustomObject]@{
            alias = $_.Name
            type  = $adapterType
        }
    }

    $adapters | ConvertTo-Json -Compress
} catch {
    $errorOutput = @{ error = "An unexpected error occurred while getting network adapters: $($_.Exception.Message)" }
    $errorOutput | ConvertTo-Json -Compress
    exit 0
}