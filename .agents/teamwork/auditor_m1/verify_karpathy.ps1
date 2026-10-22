Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipPath = 'C:\Users\Hype\Kuliah\Proyekan\andrej-karpathy-skills-main.zip'
$diskPath1 = 'C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main\.agents\skills\karpathy-guidelines\SKILL.md'
$diskPath2 = 'C:\Users\Hype\Kuliah\Proyekan\Bot WA Scraping 3.0\Bot-Wa-Scraping-3.0-main\skills\karpathy\skills\karpathy-guidelines\SKILL.md'

$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$entry = $zip.GetEntry('andrej-karpathy-skills-main/skills/karpathy-guidelines/SKILL.md')

if ($null -eq $entry) {
    Write-Error "Entry not found in zip!"
    exit 1
}

$stream = $entry.Open()
$memStream = New-Object System.IO.MemoryStream
$stream.CopyTo($memStream)
$stream.Close()
$zipBytes = $memStream.ToArray()
$memStream.Close()
$zip.Dispose()

$sha = [System.Security.Cryptography.SHA256]::Create()
$zipHash = [BitConverter]::ToString($sha.ComputeHash($zipBytes)).Replace('-', '').ToLower()

$disk1Bytes = [System.IO.File]::ReadAllBytes($diskPath1)
$disk1Hash = [BitConverter]::ToString($sha.ComputeHash($disk1Bytes)).Replace('-', '').ToLower()

$disk2Bytes = [System.IO.File]::ReadAllBytes($diskPath2)
$disk2Hash = [BitConverter]::ToString($sha.ComputeHash($disk2Bytes)).Replace('-', '').ToLower()

Write-Output "=== Karpathy Guidelines Checksum Verification ==="
Write-Output "Zip archive size: $((Get-Item $zipPath).Length) bytes"
Write-Output "Zip entry length: $($entry.Length) bytes"
Write-Output "Zip entry SHA256: $zipHash"
Write-Output "Disk 1 (.agents): $disk1Hash (Matches: $($zipHash -eq $disk1Hash), Bytes: $($disk1Bytes.Length))"
Write-Output "Disk 2 (skills) : $disk2Hash (Matches: $($zipHash -eq $disk2Hash), Bytes: $($disk2Bytes.Length))"

# Check content difference if any
$zipText = [System.Text.Encoding]::UTF8.GetString($zipBytes)
$disk1Text = [System.Text.Encoding]::UTF8.GetString($disk1Bytes)
$diff = ($zipText -eq $disk1Text)
Write-Output "Byte-for-byte identical to .agents: $diff"
