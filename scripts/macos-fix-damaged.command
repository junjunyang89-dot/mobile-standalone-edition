#!/bin/bash
# macOS 会把 QQ/浏览器传来的未签名应用标成「已损坏」。清掉隔离属性即可打开。
set -e
APP=""
if [ -d "/Applications/Mobile Standalone Edition.app" ]; then
  APP="/Applications/Mobile Standalone Edition.app"
elif [ -d "$HOME/Downloads/Mobile Standalone Edition.app" ]; then
  APP="$HOME/Downloads/Mobile Standalone Edition.app"
else
  echo "把 App 拖进这个窗口后回车："
  read -r APP
  APP="${APP%\'}"
  APP="${APP#\'}"
fi
if [ ! -d "$APP" ]; then
  echo "找不到应用: $APP"
  exit 1
fi
echo "Clearing quarantine: $APP"
xattr -cr "$APP"
echo "Done. Opening..."
open "$APP"
