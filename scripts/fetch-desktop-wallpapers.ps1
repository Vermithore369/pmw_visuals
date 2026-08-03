param(
    [string]$CloudName = "nhxfoykh",
    [string]$ApiKey = "221359791353845",
    [string[]]$FolderNames = @("Home/Fantasy", "Home/Minimalist"),
    [switch]$SecretFromClipboard,
    [switch]$SecretPromptWindow
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $repoRoot "work\desktop-wallpaper-import"
$thumbnailDirectory = Join-Path $outputDirectory "thumbs"
$manifestPath = Join-Path $outputDirectory "cloudinary-assets.json"

New-Item -ItemType Directory -Force -Path $thumbnailDirectory | Out-Null

$secretPointer = [IntPtr]::Zero

try {
    if ($env:CLOUDINARY_API_SECRET) {
        $apiSecret = $env:CLOUDINARY_API_SECRET.Trim()
    } elseif ($SecretPromptWindow) {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing

        $form = New-Object Windows.Forms.Form
        $form.Text = "Cloudinary access"
        $form.StartPosition = "CenterScreen"
        $form.ClientSize = New-Object Drawing.Size(430, 145)
        $form.FormBorderStyle = "FixedDialog"
        $form.MaximizeBox = $false
        $form.MinimizeBox = $false

        $label = New-Object Windows.Forms.Label
        $label.Text = "Paste the Cloudinary API secret:"
        $label.AutoSize = $true
        $label.Location = New-Object Drawing.Point(18, 18)
        $form.Controls.Add($label)

        $secretBox = New-Object Windows.Forms.TextBox
        $secretBox.Location = New-Object Drawing.Point(18, 48)
        $secretBox.Size = New-Object Drawing.Size(392, 25)
        $secretBox.UseSystemPasswordChar = $true
        $form.Controls.Add($secretBox)

        $okButton = New-Object Windows.Forms.Button
        $okButton.Text = "Continue"
        $okButton.DialogResult = [Windows.Forms.DialogResult]::OK
        $okButton.Location = New-Object Drawing.Point(310, 92)
        $form.Controls.Add($okButton)
        $form.AcceptButton = $okButton

        $form.Add_Shown({ $secretBox.Focus() })
        if ($form.ShowDialog() -ne [Windows.Forms.DialogResult]::OK) {
            throw "Cloudinary import canceled."
        }
        $apiSecret = $secretBox.Text.Trim()
        $form.Dispose()
    } elseif ($SecretFromClipboard) {
        $clipboardValue = Get-Clipboard -Raw
        $apiSecret = if ($null -eq $clipboardValue) { "" } else { $clipboardValue.Trim() }
        if (-not $apiSecret) {
            throw "The clipboard is empty. Copy the Cloudinary API secret, then run the command again."
        }
    } else {
        $secureSecret = Read-Host "Cloudinary API secret" -AsSecureString
        $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
        $apiSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    }
    $credentials = [Convert]::ToBase64String(
        [Text.Encoding]::ASCII.GetBytes("${ApiKey}:${apiSecret}")
    )
    $headers = @{ Authorization = "Basic $credentials" }

    function Invoke-CloudinaryRequest {
        param(
            [Parameter(Mandatory)] [string]$Uri,
            [ValidateSet("Get", "Post")] [string]$Method = "Get",
            [hashtable]$Body
        )

        $parameters = @{
            Uri = $Uri
            Method = $Method
            Headers = $headers
        }

        if ($Body) {
            $parameters.ContentType = "application/json"
            $parameters.Body = $Body | ConvertTo-Json -Depth 5 -Compress
        }

        Invoke-RestMethod @parameters
    }

    function Get-CloudinaryFolders {
        param([string]$ParentPath = "")

        $endpoint = if ($ParentPath) {
            $encodedPath = ($ParentPath -split "/" | ForEach-Object {
                [Uri]::EscapeDataString($_)
            }) -join "/"
            "https://api.cloudinary.com/v1_1/$CloudName/folders/$encodedPath"
        } else {
            "https://api.cloudinary.com/v1_1/$CloudName/folders"
        }

        $response = Invoke-CloudinaryRequest -Uri $endpoint
        $folders = @($response.folders)
        $allFolders = @($folders)

        foreach ($folder in $folders) {
            $allFolders += Get-CloudinaryFolders -ParentPath $folder.path
        }

        $allFolders
    }

    function Get-ResourcesByExpression {
        param([Parameter(Mandatory)] [string]$Expression)

        $resources = @()
        $cursor = $null

        do {
            $body = @{
                expression = $Expression
                max_results = 500
                with_field = @("context", "metadata", "tags")
            }
            if ($cursor) { $body.next_cursor = $cursor }

            $response = Invoke-CloudinaryRequest `
                -Uri "https://api.cloudinary.com/v1_1/$CloudName/resources/search" `
                -Method Post `
                -Body $body

            $resources += @($response.resources)
            $cursor = $response.next_cursor
        } while ($cursor)

        $resources
    }

    function Get-ResourcesByAssetFolder {
        param([Parameter(Mandatory)] [string]$FolderPath)

        $resources = @()
        $cursor = $null

        do {
            $encodedFolder = [Uri]::EscapeDataString($FolderPath)
            $endpoint = "https://api.cloudinary.com/v1_1/$CloudName/resources/by_asset_folder?asset_folder=$encodedFolder&max_results=500&tags=true&metadata=true&context=true"
            if ($cursor) {
                $endpoint += "&next_cursor=$([Uri]::EscapeDataString($cursor))"
            }

            $response = Invoke-CloudinaryRequest -Uri $endpoint
            $resources += @($response.resources)
            $cursor = $response.next_cursor
        } while ($cursor)

        $resources
    }

    function Get-AllImageResources {
        $resources = @()
        $cursor = $null

        do {
            $endpoint = "https://api.cloudinary.com/v1_1/$CloudName/resources/image/upload?max_results=500&context=true&metadata=true&tags=true"
            if ($cursor) {
                $endpoint += "&next_cursor=$([Uri]::EscapeDataString($cursor))"
            }

            $response = Invoke-CloudinaryRequest -Uri $endpoint
            $resources += @($response.resources)
            $cursor = $response.next_cursor
        } while ($cursor)

        $resources
    }

    function Get-CloudinaryImageSearchSummary {
        try {
            $summary = Invoke-CloudinaryRequest `
                -Uri "https://api.cloudinary.com/v1_1/$CloudName/resources/search" `
                -Method Post `
                -Body @{
                    expression = "resource_type:image"
                    max_results = 20
                }

            return [ordered]@{
                total_count = $summary.total_count
                returned_resources = @($summary.resources).Count
                has_next_cursor = [bool]$summary.next_cursor
            }
        } catch {
            return [ordered]@{
                error = $_.Exception.Message
            }
        }
    }

    function Get-DesktopCategory {
        param([Parameter(Mandatory)] [string]$FolderPath)

        $leafName = ($FolderPath -split "/")[-1].ToLowerInvariant()
        if ($leafName -like "*fantasy*") { return "Fantasy" }
        if ($leafName -like "*minimalist*") { return "Minimalist" }
        if ($leafName -like "*nature*") { return "Nature Desktop" }
        return (Get-Culture).TextInfo.ToTitleCase($leafName)
    }

    Write-Host "Reading Cloudinary desktop wallpaper folders..."
    $resourceGroups = @()
    foreach ($folderName in $FolderNames) {
        $category = Get-DesktopCategory -FolderPath $folderName
        $matchedResources = @()
        $matchedPath = $folderName
        $leafName = ($folderName -split "/")[-1]
        $candidatePaths = @(
            $folderName,
            "Home/$leafName",
            $leafName,
            (Get-Culture).TextInfo.ToTitleCase($leafName),
            "Home/$((Get-Culture).TextInfo.ToTitleCase($leafName))",
            $leafName.ToLowerInvariant(),
            "$leafName wallpapers",
            "Home/$leafName wallpapers",
            "$((Get-Culture).TextInfo.ToTitleCase($leafName)) Wallpapers",
            "Home/$((Get-Culture).TextInfo.ToTitleCase($leafName)) Wallpapers"
        ) | Select-Object -Unique

        foreach ($candidatePath in $candidatePaths) {
            try {
                $matchedResources = @(Get-ResourcesByAssetFolder -FolderPath $candidatePath)
            } catch {
                $matchedResources = @()
            }
            if ($matchedResources.Count -gt 0) {
                $matchedPath = $candidatePath
                break
            }
        }

        if ($matchedResources.Count -gt 0) {
            Write-Host "Found $($matchedResources.Count) $category images in $matchedPath."
            $resourceGroups += [pscustomobject]@{
                Category = $category
                FolderPath = $matchedPath
                Resources = $matchedResources
            }
        }
    }

    if ($resourceGroups.Count -eq 0) {
        Write-Host "Asset-folder lookup was unavailable. Checking public ID paths..."
        $allResources = @(Get-AllImageResources)

        foreach ($folderName in $FolderNames) {
            $category = Get-DesktopCategory -FolderPath $folderName
            $leafName = ($folderName -split "/")[-1]
            $matchedResources = @($allResources | Where-Object {
                $folderValues = @($_.asset_folder, $_.folder, $_.public_id) | Where-Object { $_ }
                $joinedValues = ($folderValues -join "/").ToLowerInvariant()
                $joinedValues.Contains($folderName.ToLowerInvariant()) -or
                    $joinedValues.Contains($leafName.ToLowerInvariant())
            })

            if ($matchedResources.Count -gt 0) {
                $detectedFolder = @($matchedResources | ForEach-Object {
                    if ($_.asset_folder) { $_.asset_folder } elseif ($_.folder) { $_.folder } else { $folderName }
                } | Select-Object -Unique) -join ", "
                Write-Host "Found $($matchedResources.Count) $category images in $detectedFolder."
                $resourceGroups += [pscustomobject]@{
                    Category = $category
                    FolderPath = $detectedFolder
                    Resources = $matchedResources
                }
            }
        }
    }

    if ($resourceGroups.Count -eq 0) {
        $diagnosticPath = Join-Path $outputDirectory "cloudinary-diagnostic.json"
        $searchSummary = Get-CloudinaryImageSearchSummary
        $diagnostic = [ordered]@{
            cloud_name = $CloudName
            requested_folders = @($FolderNames)
            search_summary = $searchSummary
            message = if ($searchSummary.total_count -gt 0 -and $searchSummary.returned_resources -eq 0) {
                "Cloudinary authenticated and found image counts, but this API key did not return asset records. Generate or enable an API key with permission to read asset/resource details."
            } else {
                "Cloudinary authenticated, but no matching image assets were returned for the requested folders."
            }
        }
        [IO.File]::WriteAllText(
            $diagnosticPath,
            ($diagnostic | ConvertTo-Json -Depth 5),
            [Text.UTF8Encoding]::new($false)
        )
        throw "$($diagnostic.message) Diagnostic: $diagnosticPath"
    }

    $assets = @()
    foreach ($group in $resourceGroups) {
        $category = $group.Category
        foreach ($resource in @($group.Resources)) {
            $extension = if ($resource.format) { $resource.format.ToLowerInvariant() } else { "jpg" }
            $safeId = ($resource.public_id -replace "[^a-zA-Z0-9_-]", "-").Trim("-")
            $thumbnailPath = Join-Path $thumbnailDirectory "$safeId.$extension"
            $thumbnailUrl = $resource.secure_url -replace "/image/upload/", "/image/upload/c_fit,w_640,h_360,q_auto,f_auto/"

            if (-not (Test-Path $thumbnailPath)) {
                Invoke-WebRequest -Uri $thumbnailUrl -OutFile $thumbnailPath
            }

            $assetId = if ($resource.asset_id) { $resource.asset_id } else { $resource.public_id }
            $format = if ($resource.format) { $resource.format.ToUpperInvariant() } else { "IMAGE" }

            $assets += [pscustomobject][ordered]@{
                id = $assetId
                public_id = $resource.public_id
                asset_folder = if ($resource.asset_folder) { $resource.asset_folder } else { $group.FolderPath }
                category = $category
                width = $resource.width
                height = $resource.height
                format = $format
                bytes = $resource.bytes
                version = $resource.version
                created_at = $resource.created_at
                secure_url = $resource.secure_url
                thumbnail = $thumbnailUrl
                local_thumbnail = (Resolve-Path -Relative $thumbnailPath).Replace("\", "/")
                context = $resource.context
                metadata = $resource.metadata
                existing_tags = @($resource.tags)
            }
        }
    }

    $assets = @($assets | Sort-Object category, public_id -Unique)
    $manifestJson = $assets | ConvertTo-Json -Depth 12
    [IO.File]::WriteAllText($manifestPath, $manifestJson, [Text.UTF8Encoding]::new($false))

    Write-Host ""
    Write-Host "Imported $($assets.Count) desktop wallpaper assets."
    foreach ($group in ($assets | Group-Object category)) {
        Write-Host "  $($group.Name): $($group.Count)"
    }
    Write-Host "Manifest: $manifestPath"
    Write-Host "Thumbnails: $thumbnailDirectory"
}
finally {
    if ($secretPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    }
    Remove-Variable apiSecret -ErrorAction SilentlyContinue
}
