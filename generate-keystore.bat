@echo off
echo Generating keystore...
keytool -genkey -v -keystore android/keystores/release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000 -storepass your_secure_password -keypass your_secure_password -dname "CN=Android Debug,O=Android,C=US"

echo.
echo Keystore generated at: android/keystores/release.keystore
echo.
echo IMPORTANT: Replace 'your_secure_password' with a strong password in this script and in your eas.json file
echo Also, add android/keystores/ to your .gitignore file to keep your keystore secure.
