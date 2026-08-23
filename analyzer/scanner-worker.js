"use strict";

importScripts("./parser.js?v=20260823-72");

const Parser = self.ArbitrationLogParser;
const tokenPool = new Map();

function detach(value) {
  const text = String(value || "");
  return text ? text.split("").join("") : "";
}

function internToken(value) {
  const existing = tokenPool.get(value);
  if (existing !== undefined) return existing;
  const token = detach(value);
  tokenPool.set(token, token);
  return token;
}

self.onmessage = async (event) => {
  const { file, index, start, end, chunkSize } = event.data || {};
  try {
    if (!file || typeof file.slice !== "function") throw new Error("The selected log could not be cloned into the scanner worker.");
    const decoder = new TextDecoder();
    const lines = [];
    let offset = Number(start || 0);
    let buffer = "";

    const scan = (text) => Parser.forEachRelevantLine(text, (line, token) => {
      // RegExp captures and sliced lines can retain their entire decoded parent
      // chunk. Detach the small values before keeping them for transfer.
      lines.push(internToken(token), detach(line));
    });

    while (offset < end) {
      const next = Math.min(end, offset + chunkSize);
      const bytes = await file.slice(offset, next).arrayBuffer();
      buffer += decoder.decode(bytes, { stream: next < end });
      const boundary = buffer.lastIndexOf("\n");
      if (boundary >= 0) {
        scan(buffer.slice(0, boundary + 1));
        buffer = detach(buffer.slice(boundary + 1));
      }
      offset = next;
      self.postMessage({ type: "progress", index, bytes: offset - start });
    }

    buffer += decoder.decode();
    if (buffer) scan(`${buffer}\n`);
    self.postMessage({ type: "result", index, lines });
  } catch (error) {
    self.postMessage({ type: "error", index, message: error?.message || String(error) });
  }
};
