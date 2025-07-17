#!/bin/bash

# Test script for verifying image format conversion
# Usage: ./test-formats.sh <worker-url> <image-path>

WORKER_URL=${1:-"http://localhost:8787"}
IMAGE_PATH=${2:-"test.jpg"}

echo "Testing image format conversion..."
echo "Worker URL: $WORKER_URL"
echo "Image path: $IMAGE_PATH"
echo ""

# Function to check Content-Type and format
check_format() {
    local accept="$1"
    local expected="$2"
    
    echo "Testing with Accept: $accept"
    response=$(curl -s -D - -H "Accept: $accept" "$WORKER_URL/$IMAGE_PATH" -o /tmp/test-image)
    
    # Extract headers
    content_type=$(echo "$response" | grep -i "content-type:" | cut -d' ' -f2- | tr -d '\r')
    requested_format=$(echo "$response" | grep -i "x-requested-format:" | cut -d' ' -f2- | tr -d '\r')
    
    echo "  Content-Type: $content_type"
    echo "  X-Requested-Format: $requested_format"
    
    # Use file command to check actual format
    if [ -f /tmp/test-image ]; then
        file_info=$(file /tmp/test-image)
        echo "  File info: $file_info"
        
        # Check if the file is actually AVIF or WebP
        if [[ "$expected" == "avif" && "$file_info" == *"AVIF"* ]]; then
            echo "  ✅ Successfully converted to AVIF"
        elif [[ "$expected" == "webp" && "$file_info" == *"WebP"* ]]; then
            echo "  ✅ Successfully converted to WebP"
        elif [[ "$expected" == "original" ]]; then
            echo "  ✅ Returned original format"
        else
            echo "  ❌ Format mismatch! Expected: $expected"
        fi
    fi
    
    echo ""
}

# Test AVIF support
check_format "image/avif,image/webp,image/*" "avif"

# Test WebP support (without AVIF)
check_format "image/webp,image/*" "webp"

# Test original format (no modern format support)
check_format "image/jpeg" "original"

# Test with curl user agent (should get WebP on modern curl)
echo "Testing with curl default Accept header:"
curl -I "$WORKER_URL/$IMAGE_PATH" | grep -E "(content-type:|x-requested-format:)"

echo ""
echo "Testing with browser-like Accept header:"
curl -I -H "Accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" "$WORKER_URL/$IMAGE_PATH" | grep -E "(content-type:|x-requested-format:)"

# Clean up
rm -f /tmp/test-image