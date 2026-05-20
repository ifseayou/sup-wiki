import Foundation
import Vision
import CoreGraphics
import ImageIO

guard CommandLine.arguments.count >= 2 else {
  fputs("Usage: swift scripts/ocr-image-macos-json.swift /path/image.png\n", stderr)
  exit(2)
}

let imageURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard
  let source = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
  let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
else {
  fputs("Unable to load image\n", stderr)
  exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
if #available(macOS 13.0, *) {
  request.revision = VNRecognizeTextRequestRevision3
  request.recognitionLanguages = ["zh-Hans", "en-US"]
} else {
  request.recognitionLanguages = ["zh-Hans", "en-US"]
}

let handler = VNImageRequestHandler(cgImage: image, options: [:])
do {
  try handler.perform([request])
  let rows = (request.results ?? []).compactMap { item -> [String: Any]? in
    guard let candidate = item.topCandidates(1).first else { return nil }
    let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
    if text.isEmpty { return nil }
    let box = item.boundingBox
    return [
      "text": text,
      "x": box.origin.x,
      "y": box.origin.y,
      "w": box.size.width,
      "h": box.size.height
    ]
  }
  let data = try JSONSerialization.data(withJSONObject: rows, options: [.prettyPrinted, .sortedKeys])
  FileHandle.standardOutput.write(data)
  print("")
} catch {
  fputs("OCR failed: \(error)\n", stderr)
  exit(1)
}
