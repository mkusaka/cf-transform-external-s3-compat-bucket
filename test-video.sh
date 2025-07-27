#!/bin/bash

# Test script for MP4 Media Transformations proxy

echo "Testing MP4 file detection and Media Transformations proxy..."
echo

# Replace with your actual worker URL
WORKER_URL="http://localhost:8787"

# Test 1: Basic MP4 request
echo "Test 1: Basic MP4 request"
curl -i "$WORKER_URL/sample-video.mp4" | head -20
echo
echo "---"
echo

# Test 2: Check debug headers for MP4 detection
echo "Test 2: Debug headers for MP4 detection"
curl -s -I "$WORKER_URL/sample-video.mp4" | grep -E "X-Media-Transform|X-Content-Type"
echo
echo "---"
echo

# Test 3: Non-MP4 file (should not proxy through Media Transformations)
echo "Test 3: Non-MP4 file (e.g., image)"
curl -s -I "$WORKER_URL/sample-image.jpg" | grep -E "X-Media-Transform|X-Content-Type"
echo

echo "Test complete!"