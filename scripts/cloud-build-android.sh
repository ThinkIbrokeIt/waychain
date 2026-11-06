#!/usr/bin/env bash
# Cloud Android build for WayChain mobile.
# Run ON the cloud instance (Ubuntu 24.04, 8+ vCPU, 50GB SSD).
# Builds app-release.apk (includes tower logos already in mobile/assets/),
# then the operator pulls it locally and adb-installs to the phone.
set -e
export DEBIAN_FRONTEND=noninteractive

echo "=== [0] system deps ==="
sudo apt-get update -y
sudo apt-get install -y openjdk-17-jdk git unzip curl python3 python3-pip \
  build-essential libc++1 nodejs npm

echo "=== [1] Node 20 (if apt gave old node) ==="
if ! node -v | grep -q "v20\|v21\|v22"; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v; npm -v

echo "=== [2] Android SDK (cmdline-tools) ==="
export ANDROID_HOME=/home/ubuntu/android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
mkdir -p $ANDROID_HOME/cmdline-tools
cd $ANDROID_HOME/cmdline-tools
curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o cmd.zip
unzip -q cmd.zip
mv cmdline-tools latest
rm cmd.zip
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin

yes | sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-35" \
  "build-tools;35.0.0" "ndk;27.1.12297006"

echo "=== [3] get the mobile source ==="
# Option A: git clone monorepo (needs creds) — use scp from operator instead.
# This script assumes /home/ubuntu/waychain-mobile already copied in, or:
if [ ! -d /home/ubuntu/waychain/mobile ]; then
  echo "ERROR: expected /home/ubuntu/waychain/mobile — copy it via scp first"
  exit 1
fi
cd /home/ubuntu/waychain/mobile

echo "=== [4] npm ci ==="
npm ci 2>&1 | tail -5

echo "=== [5] expo prebuild ==="
npx expo prebuild --platform android --clean 2>&1 | tail -10

echo "=== [6] local.properties + androidx block ==="
cat > android/local.properties <<EOF
sdk.dir=/home/ubuntu/android-sdk
EOF
if ! grep -q "androidx.core" android/app/build.gradle; then
  sed -i 's/dependencies {/dependencies {\n    implementation "androidx.core:core-ktx:1.15.0"/' android/app/build.gradle
fi

echo "=== [7] gradle assembleRelease ==="
cd android && ./gradlew assembleRelease --no-daemon 2>&1 | tail -25

echo "=== [8] APK ==="
find /home/ubuntu/waychain/mobile/android -name "app-release.apk" | head -1
echo "BUILD_DONE"
