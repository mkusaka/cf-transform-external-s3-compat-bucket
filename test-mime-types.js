import { lookup } from "mime-types";

// Test various file extensions
const testFiles = [
  "video.mp4",
  "video.MP4",
  "1.mp4",
  "test.webm",
  "movie.mov",
  "video.avi",
  "clip.mkv",
  "image.jpg",
  "photo.png",
  "animation.gif",
  "picture.webp",
  "image.avif",
];

console.log("Testing mime-types detection:\n");

testFiles.forEach((file) => {
  const mimeType = lookup(file) || "unknown";
  const isVideo = mimeType.startsWith("video/") || mimeType === "application/mp4";
  const isMp4 = mimeType === "video/mp4" || mimeType === "application/mp4";

  console.log(`File: ${file}`);
  console.log(`  MIME type: ${mimeType}`);
  console.log(`  Is video: ${isVideo}`);
  console.log(`  Is MP4: ${isMp4}`);
  console.log("");
});

// Check what mime-types actually returns for .mp4
console.log("Detailed check for .mp4 extension:");
console.log(`lookup('test.mp4'): ${lookup("test.mp4")}`);
console.log(`lookup('.mp4'): ${lookup(".mp4")}`);
console.log(`lookup('mp4'): ${lookup("mp4")}`);
