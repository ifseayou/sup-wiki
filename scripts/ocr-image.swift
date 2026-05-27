import Foundation
import Vision
import AppKit

if CommandLine.arguments.count < 2 {
  fputs("Usage: swift scripts/ocr-image.swift image.png\n", stderr)
  exit(1)
}

let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let nsImage = NSImage(contentsOf: url) else {
  fputs("Cannot load image: \(url.path)\n", stderr)
  exit(2)
}
var rect = NSRect(origin: .zero, size: nsImage.size)
guard let image = nsImage.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
  fputs("Cannot create CGImage: \(url.path)\n", stderr)
  exit(2)
}

let request = VNRecognizeTextRequest { request, error in
  if let error = error {
    fputs("OCR error: \(error)\n", stderr)
    exit(3)
  }
  let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
  let lines = observations.compactMap { $0.topCandidates(1).first?.string }
  print(lines.joined(separator: "\n"))
}

request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "en-US"]

let handler = VNImageRequestHandler(cgImage: image, options: [:])
do {
  try handler.perform([request])
} catch {
  fputs("Vision request failed: \(error)\n", stderr)
  exit(4)
}
