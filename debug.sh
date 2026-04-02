#!/bin/bash
# Debug script for Prompt Editor

set -e

echo "=== Building Prompt Editor ==="
./build.sh

echo ""
echo "=== Enabling Safari Developer Tools ==="
defaults write com.apple.Safari IncludeDevelopMenu -bool true 2>/dev/null || true
defaults write com.apple.Safari WebKitDeveloperExtrasEnabledPreferenceKey -bool true 2>/dev/null || true

echo ""
echo "=== Stopping existing PromptEditor ==="
killall PromptEditor 2>/dev/null || true
sleep 1

echo ""
echo "=== Starting Prompt Editor ==="
open build/PromptEditor.app

echo ""
echo "=== Waiting for app to load ==="
sleep 3

echo ""
echo "==============================================="
echo "✅ Prompt Editor 已启动！"
echo ""
echo "查看日志的方式："
echo ""
echo "1️⃣  命令行日志（实时）："
echo "   log stream --predicate 'process == \"PromptEditor\"' --level debug"
echo ""
echo "2️⃣  Safari 开发者工具（WebView 控制台）："
echo "   - 打开 Safari"
echo "   - 菜单栏：开发 > $(hostname -s) > PromptEditor"
echo "   - 点击 Console 标签"
echo ""
echo "==============================================="
echo ""

# 自动开始查看日志
echo "正在自动开启日志监控（按 Ctrl+C 停止）..."
sleep 2
log stream --predicate 'process == "PromptEditor"' --level debug 2>&1 | grep -E "(\[bridge\]|\[AgentDetector\]|\[MainWindow\]|Sending|Found)" || true
