# Create keystore directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "android\keystores" | Out-Null

# Ask for keystore password
$keystorePass = Read-Host -Prompt "Enter a secure password for your keystore (min 6 characters)" -AsSecureString
$keystorePass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($keystorePass))

# Generate keystore
try {
    Write-Host "Generating keystore..." -ForegroundColor Cyan
    
    # Generate the keystore
    keytool -genkey -v `
        -keystore android/keystores/release.keystore `
        -alias release `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -storepass $keystorePass `
        -keypass $keystorePass `
        -dname "CN=Android,O=Android,C=US"
    
    # Verify keystore was created
    if (Test-Path "android/keystores/release.keystore") {
        Write-Host "`n✅ Keystore successfully created at: android/keystores/release.keystore" -ForegroundColor Green
        
        # Get SHA-1 fingerprint
        Write-Host "`n🔑 SHA-1 Fingerprint:" -ForegroundColor Cyan
        keytool -list -v -keystore android/keystores/release.keystore -alias release -storepass $keystorePass -keypass $keystorePass | Select-String "SHA1"
        
        # Update credentials.json
        $credentials = @{
            android = @{
                keystore = @{
                    keystorePath = "android/keystores/release.keystore"
                    keystorePassword = $keystorePass
                    keyAlias = "release"
                    keyPassword = $keystorePass
                }
            }
        } | ConvertTo-Json -Depth 3
        
        $credentials | Out-File -FilePath "credentials.json" -Encoding utf8
        
        Write-Host "`n🔐 Credentials file updated. Make sure to keep this information secure!" -ForegroundColor Yellow
        Write-Host "   - Keystore path: android/keystores/release.keystore"
        Write-Host "   - Alias: release"
        Write-Host "   - Password: [the password you entered]"
        Write-Host "`n⚠️  IMPORTANT: Add these to your password manager and keep them safe!" -ForegroundColor Red
    } else {
        Write-Host "❌ Failed to create keystore" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ An error occurred: $_" -ForegroundColor Red
}

# Clear the password from memory
$keystorePass = $null
[System.GC]::Collect()
