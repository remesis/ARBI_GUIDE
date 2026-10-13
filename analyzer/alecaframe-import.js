// Handoff: /analyzer/?afPort=<port>&afArbitrationID=<id> (fragment form also supported).
// GET http://127.0.0.1:<port>/v1/arbExports/<id>, without cookies or extra authentication.
// Return 200 with plain UTF-8 EE.log text, or 404 if the saved run is unavailable.
// The local service must allow the https://arbi.guide origin through CORS.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ArbitrationAlecaFrameImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PORT_KEY = "afPort";
  const ID_KEY = "afArbitrationID";
  const MAX_BYTES = 2 * 1024 * 1024 * 1024;
  const TIMEOUT_MS = 120000;
  let generation = 0;
  let activeController = null;
  let controls = null;

  function readLink(href) {
    const url = new URL(href);
    const query = url.searchParams;
    const fragment = new URLSearchParams(url.hash.slice(1));
    const hasKeys = (params) => params.has(PORT_KEY) || params.has(ID_KEY);
    if (!hasKeys(query) && !hasKeys(fragment)) return null;
    if (hasKeys(query) && hasKeys(fragment)) throw new Error("The AlecaFrame link contains conflicting import parameters. Open the run again from AlecaFrame.");
    const params = hasKeys(fragment) ? fragment : query;
    const port = params.get(PORT_KEY) || "";
    const id = params.get(ID_KEY) || "";
    if (params.getAll(PORT_KEY).length !== 1 || params.getAll(ID_KEY).length !== 1
      || !/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65535
      || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
      throw new Error("The AlecaFrame link is invalid. Open the run again from AlecaFrame, or choose its exported log.");
    }
    params.delete(PORT_KEY);
    params.delete(ID_KEY);
    if (params === fragment) url.hash = fragment.toString();
    return {
      endpoint: `http://127.0.0.1:${port}/v1/arbExports/${encodeURIComponent(id)}`,
      filename: `Arbitration_${id}.log`,
      cleanUrl: url.href,
    };
  }

  function removeControls() {
    controls?.remove();
    controls = null;
  }

  function cancel() {
    generation += 1;
    activeController?.abort();
    activeController = null;
    removeControls();
  }

  function setStatus(message, error = false) {
    const status = document.querySelector("#parseStatus");
    if (!status) return;
    status.className = `parse-status${error ? " error" : ""}`;
    status.textContent = message;
  }

  function showControl(label, action) {
    removeControls();
    const status = document.querySelector("#parseStatus");
    if (!status) return;
    controls = document.createElement("div");
    controls.id = "alecaframeImportControls";
    const button = document.createElement("button");
    button.className = "secondary-button";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", action);
    controls.append(button);
    status.after(controls);
  }

  async function download(link, signal, progress = () => {}, fetchImpl = globalThis.fetch) {
    const response = await fetchImpl(link.endpoint, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { Accept: "text/plain" },
      targetAddressSpace: "loopback",
      signal,
    });
    if (response.status === 404) throw new Error("This run is no longer stored in AlecaFrame. Choose a saved log or open another run.");
    if (!response.ok) throw new Error(`AlecaFrame could not export this run (HTTP ${response.status}). Try again or choose the exported log.`);
    const type = (response.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
    if (type && !["text/plain", "application/octet-stream"].includes(type)) {
      throw new Error("AlecaFrame returned an unsupported export. The Analyzer needs the original log as plain UTF-8 text.");
    }
    const length = Number(response.headers.get("Content-Length")) || 0;
    if (length > MAX_BYTES) throw new Error("This AlecaFrame export exceeds 2 GB. Choose the log file directly instead.");
    const chunks = [];
    let bytes = 0;
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (signal.aborted) throw new DOMException("Import cancelled", "AbortError");
          bytes += value.byteLength;
          if (bytes > MAX_BYTES) throw new Error("This AlecaFrame export exceeds 2 GB. Choose the log file directly instead.");
          chunks.push(value);
          progress(bytes);
        }
      } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
      } finally { reader.releaseLock(); }
    } else {
      const blob = await response.blob();
      bytes = blob.size;
      if (bytes > MAX_BYTES) throw new Error("This AlecaFrame export exceeds 2 GB. Choose the log file directly instead.");
      chunks.push(blob);
    }
    if (signal.aborted) throw new DOMException("Import cancelled", "AbortError");
    if (!bytes) throw new Error("AlecaFrame returned an empty log. Try exporting the run again.");
    return new File(chunks, link.filename, { type: "text/plain" });
  }

  async function start(importFile) {
    let link;
    try { link = readLink(globalThis.location.href); }
    catch (error) { setStatus(error.message, true); return; }
    if (!link) return;
    // Keep the handoff values out of subsequent page URLs and referrers.
    try { history.replaceState(history.state, "", link.cleanUrl); } catch (_) {}

    async function load() {
      cancel();
      const current = generation;
      const controller = new AbortController();
      activeController = controller;
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
      setStatus("Connecting to AlecaFrame… Allow local access if your browser asks.");
      showControl("Cancel import", () => {
        cancel();
        setStatus("AlecaFrame import cancelled. You can still choose a log file.");
      });
      try {
        const file = await download(link, controller.signal, (bytes) => {
          if (generation === current) setStatus(`Receiving AlecaFrame log… ${(bytes / 1000000).toFixed(1)} MB`);
        });
        if (generation !== current) return;
        clearTimeout(timer);
        activeController = null;
        removeControls();
        const imported = await importFile(file, true, "alecaframe");
        if (imported === false && generation === current) showControl("Retry AlecaFrame import", () => { void load(); });
      } catch (error) {
        controller.abort();
        if (generation !== current) return;
        const message = timedOut
          ? "AlecaFrame did not respond in time. Keep it open, allow local access in your browser, and retry."
          : error instanceof TypeError || error.name === "AbortError"
            ? "Could not connect to AlecaFrame. Keep it open and allow local access for arbi.guide in your browser, then retry or choose the exported log."
            : error.message || "Could not import this AlecaFrame run. Try again or choose the exported log.";
        setStatus(message, true);
        showControl("Retry AlecaFrame import", () => { void load(); });
      } finally {
        clearTimeout(timer);
        if (activeController === controller) activeController = null;
      }
    }
    await load();
  }

  return { readLink, download, start, cancel };
});
