#!/usr/bin/env bash
set -e
export ANDROID_HOME=/home/wink/android-sdk
export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java)))) 2>/dev/null || /usr/lib/jvm/default-java
cd /home/wink/projects/waychain/mobile

echo "=== [1/5] npm ci (restore deps) ==="
npm ci 2>&1 | tail -5

echo "=== [2/5] expo prebuild (generate native android project) ==="
npx expo prebuild --platform android --clean 2>&1 | tail -15

echo "=== [3/5] set local.properties sdk.dir + androidx force block (SDK-35-only env) ==="
cat > android/local.properties <<EOF
sdk.dir=/home/wink/android-sdk
EOF
# Force androidx.core compatibility for SDK-35-only build env (per WayChain mobile notes)
if ! grep -q "androidx.core" android/app/build.gradle; then
  sed -i 's/dependencies {/dependencies {\n    implementation "androidx.core:core-ktx:1.15.0"/' android/app/build.gradle
fi

echo "=== [4/5] gradle assembleRelease ==="
cd android && ./gradlew assembleRelease --no-daemon 2>&1 | tail -25

echo "=== [5/5] locate APK ==="
find /home/wink/projects/waychain/mobile/android -name "app-release.apk" 2>/dev/null

echo "BUILD_DONE_EXIT=$?"
