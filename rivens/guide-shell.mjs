const DEFAULT_FONT_SCALE = 1;
const DEFAULT_READING_LINE_HEIGHT = 1.55;
const DEFAULT_CONTENT_MAX_WIDTH = 1200;
let fontScale = DEFAULT_FONT_SCALE, readingLineHeight = DEFAULT_READING_LINE_HEIGHT;
let contentMaxWidth = DEFAULT_CONTENT_MAX_WIDTH;
let widthAdjustTimer = null, widthAdjustDelta = 0, widthAdjustLastTs = 0, widthAdjustAccumulator = 0;
const WIDTH_ADJUST_INTERVAL_MS = 75;
let mobileSidebarMediaQuery = null, topbarResizeObserver = null;
let particleColor = "114, 199, 255", particleAlphaMult = 1, particleCount = 48;
let searchHits = [], currentSearchIndex = -1;
const SEARCH_HIGHLIGHT_DEBOUNCE_MS = 150;
let searchHighlightTimer = null, pendingSearchTerm = null;
const searchBox = document.getElementById("searchBox");
const searchPrevBtn = document.getElementById("searchPrevBtn");
const searchNextBtn = document.getElementById("searchNextBtn");
function safeStorage(kind) {
  return {
    getItem(key) { try { return window[kind].getItem(key); } catch { return null; } },
    setItem(key, value) { try { window[kind].setItem(key, value); } catch {} }
  };
}
const localStorage = safeStorage("localStorage"), sessionStorage = safeStorage("sessionStorage");
function emitGuideEvent(name, detail) {
  document.dispatchEvent(new CustomEvent("guide:" + name, {detail}));
}


    function prefersReducedMotion() {
      return typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function getTopbarHeight() {
      const topbar = document.querySelector(".topbar");
      return topbar ? Math.ceil(topbar.getBoundingClientRect().height) : 0;
    }

    function isMobileLayout() {
      if (!mobileSidebarMediaQuery) {
        mobileSidebarMediaQuery = window.matchMedia("(max-width: 900px)");
      }

      return mobileSidebarMediaQuery.matches;
    }

    function syncTopbarOffset() {
      const topbarHeight = getTopbarHeight();
      if (!topbarHeight) return;
      document.documentElement.style.setProperty("--topbar-offset", `${topbarHeight}px`);
    }

    function setupTopbarOffsetObserver() {
      syncTopbarOffset();

      const topbar = document.querySelector(".topbar");
      if (!topbar || typeof ResizeObserver === "undefined") return;

      topbarResizeObserver = new ResizeObserver(syncTopbarOffset);
      topbarResizeObserver.observe(topbar);
    }

    function applyFontScale() {
      document.documentElement.style.setProperty("--font-scale", String(fontScale));
      localStorage.setItem("guideFontScale", String(fontScale));
    }

    function applyReadingLineHeight() {
      document.documentElement.style.setProperty("--reading-line-height", String(readingLineHeight));
      localStorage.setItem("guideReadingLineHeight", String(readingLineHeight));
    }

    function applyContentMaxWidth() {
      document.documentElement.style.setProperty("--content-max-width", `${contentMaxWidth}px`);
      localStorage.setItem("guideContentMaxWidth", String(contentMaxWidth));
    }

    function resetUserControls() {
      fontScale = DEFAULT_FONT_SCALE;
      readingLineHeight = DEFAULT_READING_LINE_HEIGHT;
      contentMaxWidth = DEFAULT_CONTENT_MAX_WIDTH;
      applyFontScale();
      applyReadingLineHeight();
      applyContentMaxWidth();
    }

    function adjustContentWidth(delta) {
      const nextWidth = Math.min(1600, Math.max(860, contentMaxWidth + delta));
      if (nextWidth === contentMaxWidth) return;
      contentMaxWidth = nextWidth;
      applyContentMaxWidth();
    }

    function stopWidthAdjust() {
      if (widthAdjustTimer !== null) {
        cancelAnimationFrame(widthAdjustTimer);
        widthAdjustTimer = null;
      }
      widthAdjustDelta = 0;
      widthAdjustLastTs = 0;
      widthAdjustAccumulator = 0;
    }

    function widthAdjustTick(now) {
      if (!widthAdjustDelta) return;
      if (widthAdjustLastTs === 0) {
        widthAdjustLastTs = now;
      } else {
        widthAdjustAccumulator += now - widthAdjustLastTs;
        widthAdjustLastTs = now;
        while (widthAdjustAccumulator >= WIDTH_ADJUST_INTERVAL_MS) {
          adjustContentWidth(widthAdjustDelta);
          widthAdjustAccumulator -= WIDTH_ADJUST_INTERVAL_MS;
        }
      }
      widthAdjustTimer = requestAnimationFrame(widthAdjustTick);
    }

    function startWidthAdjust(delta) {
      stopWidthAdjust();
      widthAdjustDelta = delta;
      adjustContentWidth(delta); // immediate first step on press
      widthAdjustTimer = requestAnimationFrame(widthAdjustTick);
    }

    function bindWidthHold(button, delta) {
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        startWidthAdjust(delta);
      });

      button.addEventListener("pointerup", stopWidthAdjust);
      button.addEventListener("pointerleave", stopWidthAdjust);
      button.addEventListener("pointercancel", stopWidthAdjust);
      button.addEventListener("lostpointercapture", stopWidthAdjust);
      button.addEventListener("click", (event) => {
        event.preventDefault();
      });
    }

    function bindPressedState(button) {
      const activate = (event) => {
        if (event.type === "pointerdown" && event.button !== 0) return;
        button.classList.add("is-pressed");
      };

      const deactivate = () => {
        button.classList.remove("is-pressed");
      };

      button.addEventListener("pointerdown", activate);
      button.addEventListener("pointerup", deactivate);
      button.addEventListener("pointerleave", deactivate);
      button.addEventListener("pointercancel", deactivate);
      button.addEventListener("lostpointercapture", deactivate);
      button.addEventListener("blur", deactivate);
      window.addEventListener("pointerup", deactivate);
      window.addEventListener("blur", deactivate);
    }

    function loadFontScale() {
      const saved = localStorage.getItem("guideFontScale");
      if (!saved) return;

      const parsed = Number(saved);
      if (!Number.isFinite(parsed)) return;

      fontScale = Math.min(1.6, Math.max(0.7, parsed));
      applyFontScale();
    }

    function loadReadingLineHeight() {
      const saved = localStorage.getItem("guideReadingLineHeight");
      if (!saved) return;

      const parsed = Number(saved);
      if (!Number.isFinite(parsed)) return;

      readingLineHeight = Math.min(1.9, Math.max(1.35, parsed));
      applyReadingLineHeight();
    }

    function loadContentMaxWidth() {
      const saved = localStorage.getItem("guideContentMaxWidth");
      if (!saved) return;

      const parsed = Number(saved);
      if (!Number.isFinite(parsed)) return;

      contentMaxWidth = Math.min(1600, Math.max(860, Math.round(parsed)));
      applyContentMaxWidth();
    }

    function syncBrandLinkAria() {



      const brandLink = document.getElementById("brandLink");
      if (!brandLink) return;

      if (isMobileLayout()) {
        brandLink.setAttribute("aria-controls", "sidebar");
        brandLink.setAttribute("aria-label", "Toggle navigation menu");
        if (!brandLink.hasAttribute("aria-expanded")) {
          brandLink.setAttribute("aria-expanded", "false");
        }
      } else {
        brandLink.removeAttribute("aria-controls");
        brandLink.removeAttribute("aria-expanded");
        brandLink.removeAttribute("aria-label");
      }
    }

    function setMobileSidebarOpen(isOpen) {
      const body = document.body;
      const backdrop = document.getElementById("mobileSidebarBackdrop");
      const brandLink = document.getElementById("brandLink");

      if (!body || !backdrop || !brandLink) return;
      document.getElementById("mobileMenuBtn")?.setAttribute("aria-expanded", String(isMobileLayout() && isOpen));

      if (!isMobileLayout()) {
        body.classList.remove("mobile-sidebar-open");
        backdrop.hidden = true;
        syncBrandLinkAria();
        return;
      }

      body.classList.toggle("mobile-sidebar-open", isOpen);
      backdrop.hidden = !isOpen;
      brandLink.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    function closeMobileSidebar() {
      setMobileSidebarOpen(false);
    }

    function toggleMobileSidebar() {
      setMobileSidebarOpen(!document.body.classList.contains("mobile-sidebar-open"));
    }

    function setupMobileSidebar() {
      const brandLink = document.getElementById("brandLink");
      const backdrop = document.getElementById("mobileSidebarBackdrop");
      const menuBtn = document.getElementById("mobileMenuBtn");
      if (!brandLink || !backdrop) return;

      syncBrandLinkAria();

      brandLink.addEventListener("click", (event) => {
        if (!isMobileLayout()) return;
        event.preventDefault();
        toggleMobileSidebar();
      });

      if (menuBtn) {
        menuBtn.addEventListener("click", () => {
          toggleMobileSidebar();
        });
      }

      backdrop.addEventListener("click", () => {
        closeMobileSidebar();
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeMobileSidebar();
        }
      });
    }

    function openMobileSearch() {
      if (!isMobileLayout()) return;
      document.body.classList.add("mobile-search-active");
      const bar = document.getElementById("mobileSearchBar");
      if (bar) bar.hidden = false;
      const box = document.getElementById("mobileSearchBox");
      if (box) { box.focus(); box.select(); }
    }

    function closeMobileSearch() {
      document.body.classList.remove("mobile-search-active");
      const bar = document.getElementById("mobileSearchBar");
      if (bar) bar.hidden = true;
      const mobileBox = document.getElementById("mobileSearchBox");
      if (mobileBox) mobileBox.value = "";
      const desktopBox = document.getElementById("searchBox");
      if (desktopBox) desktopBox.value = "";
      clearSearchHighlights();
    }

    function setupMobileSearch() {
      const toggle = document.getElementById("mobileSearchToggle");
      const mobileBox = document.getElementById("mobileSearchBox");
      const mobilePrev = document.getElementById("mobileSearchPrevBtn");
      const mobileNext = document.getElementById("mobileSearchNextBtn");
      if (!toggle || !mobileBox) return;

      toggle.addEventListener("click", () => {
        if (document.body.classList.contains("mobile-search-active")) {
          closeMobileSearch();
        } else {
          openMobileSearch();
        }
      });

      mobileBox.addEventListener("input", () => {
        const desktopBox = document.getElementById("searchBox");
        if (desktopBox) {
          desktopBox.value = mobileBox.value;
          desktopBox.dispatchEvent(new Event("input", { bubbles: false }));
        }
      });

      mobileBox.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          const term = mobileBox.value.trim();
          if (!term) return;

          flushPendingSearch();
          if (searchHits.length === 0) {
            highlightSearch(term);
            if (searchHits.length) searchHits[currentSearchIndex].scrollIntoView({ behavior: "smooth", block: "center" });
          } else {

            goToSearchHit(event.shiftKey ? -1 : 1);
          }
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeMobileSearch();
        }
      });

      if (mobilePrev) {
        mobilePrev.addEventListener("click", () => { goToSearchHit(-1); });
        bindPressedState(mobilePrev);
      }
      if (mobileNext) {
        mobileNext.addEventListener("click", () => { goToSearchHit(1); });
        bindPressedState(mobileNext);
      }
    }

    function updateSearchCount() {
      const el = document.getElementById("searchCount");
      const mobileEl = document.getElementById("mobileSearchCount");
      const text = (!searchHits.length || currentSearchIndex < 0)
        ? ""
        : `${currentSearchIndex + 1} of ${searchHits.length}`;
      if (el) el.textContent = text;
      if (mobileEl) mobileEl.textContent = text;
    }

    function markCurrentSearchHit() {
      document.querySelectorAll("mark.search-hit.search-hit-current").forEach((m) => {
        m.classList.remove("search-hit-current");
      });
      if (currentSearchIndex >= 0 && searchHits[currentSearchIndex]) {
        searchHits[currentSearchIndex].classList.add("search-hit-current");
      }
    }

    function clearSearchHighlights() {
      document.querySelectorAll("mark.search-hit").forEach((mark) => {
        const parent = mark.parentNode;
        if (!parent) return;
        parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
        parent.normalize();
      });

      searchHits = [];
      currentSearchIndex = -1;
      updateSearchCount();
    }

    function highlightSearch(term) {
      clearSearchHighlights();
      if (!term.trim()) return;

      const root = document.getElementById("content");
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matchRegex = new RegExp(escaped, "i");
      const replaceRegex = new RegExp(escaped, "gi");
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

      const textNodes = [];
      let node;

      while ((node = walker.nextNode())) {
        if (!node.nodeValue.trim()) continue;

        const parentName = node.parentNode?.nodeName?.toLowerCase();
        if (["script", "style", "mark"].includes(parentName)) continue;
        if (node.parentElement?.closest("button, input, select, .combo-menu")) continue;
        if (
          node.parentElement?.closest(".mobile-tileset-guide-content") &&
          !isMobileLayout()
        ) continue;

        if (matchRegex.test(node.nodeValue)) {
          textNodes.push(node);
        }
      }

      for (const textNode of textNodes) {
        const text = textNode.nodeValue;
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        let match;

        while ((match = replaceRegex.exec(text)) !== null) {
          const start = match.index;
          const end = start + match[0].length;

          if (start > lastIndex) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
          }

          const mark = document.createElement("mark");
          mark.className = "search-hit";
          mark.textContent = text.slice(start, end);
          frag.appendChild(mark);
          searchHits.push(mark);

          lastIndex = end;
        }

        if (lastIndex < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        textNode.parentNode.replaceChild(frag, textNode);
      }

      if (searchHits.length) {
        currentSearchIndex = 0;
      } else {
        currentSearchIndex = -1;
      }

      markCurrentSearchHit();
      updateSearchCount();
    }

    function scheduleSearchHighlight(value) {
      pendingSearchTerm = value;
      if (searchHighlightTimer !== null) clearTimeout(searchHighlightTimer);
      searchHighlightTimer = setTimeout(flushPendingSearch, SEARCH_HIGHLIGHT_DEBOUNCE_MS);
    }

    function flushPendingSearch() {
      if (searchHighlightTimer !== null) {
        clearTimeout(searchHighlightTimer);
        searchHighlightTimer = null;
      }
      if (pendingSearchTerm !== null) {
        const term = pendingSearchTerm;
        pendingSearchTerm = null;
        highlightSearch(term);
      }
    }

    function cancelPendingSearch() {
      if (searchHighlightTimer !== null) {
        clearTimeout(searchHighlightTimer);
        searchHighlightTimer = null;
      }
      pendingSearchTerm = null;
    }

    function getSearchTerm() {
      return (searchBox?.value || "").trim();
    }

    function goToSearchHit(direction) {


      flushPendingSearch();

      const term = getSearchTerm();
      if (!term) {
        clearSearchHighlights();
        return;
      }

      if (searchHits.length === 0) {
        highlightSearch(term);
      }

      if (searchHits.length === 0) {
        updateSearchCount();
        return;
      }

      currentSearchIndex = (currentSearchIndex + direction + searchHits.length) % searchHits.length;
      markCurrentSearchHit();
      updateSearchCount();

      const hit = searchHits[currentSearchIndex];

      emitGuideEvent("search:result-navigate", {
        term,
        resultIndex: currentSearchIndex + 1,
        totalResults: searchHits.length,
        direction: direction > 0 ? "next" : "previous"
      });

      hit.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function handleSearchNavigation(direction) {
      flushPendingSearch();
      const term = getSearchTerm();
      if (!term) return;

      if (searchHits.length === 0) {
        highlightSearch(term);
        if (searchHits.length) {
          const hit = searchHits[currentSearchIndex];
          hit.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      goToSearchHit(direction);
    }

    (function initParticles() {
      const MOBILE_BREAKPOINT = 900;
      const CONTENT_GAP = 20;
      const MAX_DIST = 155;
      const content = document.querySelector(".content");
      const canvas = document.getElementById("particleCanvas");

      if (!content || !canvas) return;

      if (prefersReducedMotion()) return;

      const ctx = canvas.getContext("2d");

      function createParticle(width, height) {
        return {
          x: Math.random() * Math.max(width, 1),
          y: Math.random() * Math.max(height, 1),
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: Math.random() * 1.4 + 0.5
        };
      }

      const state = {
        cssWidth: 0,
        cssHeight: 0,
        particles: Array.from({ length: particleCount }, () => createParticle(window.innerWidth, window.innerHeight))
      };

      function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      function getCanvasLayout() {
        const topOffset = Math.max(0, getTopbarHeight());
        const viewportWidth = window.innerWidth;
        const viewportHeight = Math.max(0, window.innerHeight - topOffset);
        const contentRect = content.getBoundingClientRect();
        const styles = window.getComputedStyle(content);
        const paddingLeft = parseFloat(styles.paddingLeft) || 0;
        const paddingRight = parseFloat(styles.paddingRight) || 0;
        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;
        const holeLeft = clamp(Math.round(contentRect.left + paddingLeft - CONTENT_GAP), 0, viewportWidth);
        const holeRight = clamp(Math.round(contentRect.right - paddingRight + CONTENT_GAP), 0, viewportWidth);
        const holeTop = clamp(Math.round(contentRect.top - topOffset + paddingTop - CONTENT_GAP), 0, viewportHeight);
        const holeBottom = clamp(Math.round(contentRect.bottom - topOffset - paddingBottom + CONTENT_GAP), 0, viewportHeight);

        return {
          topOffset,
          width: viewportWidth,
          height: viewportHeight,
          hole: {
            left: Math.min(holeLeft, holeRight),
            top: Math.min(holeTop, holeBottom),
            right: Math.max(holeLeft, holeRight),
            bottom: Math.max(holeTop, holeBottom)
          }
        };
      }

      function syncCanvasSize(layout) {
        const width = Math.max(0, layout.width);
        const height = Math.max(0, layout.height);
        const previousWidth = state.cssWidth || width;
        const previousHeight = state.cssHeight || height;
        const sizeChanged = state.cssWidth !== width || state.cssHeight !== height;

        canvas.style.top = `${layout.topOffset}px`;
        canvas.style.height = `${height}px`;
        canvas.style.display = width > 0 && height > 0 ? "block" : "none";

        state.cssWidth = width;
        state.cssHeight = height;

        if (!sizeChanged) return;

        const dpr = window.devicePixelRatio || 1;
        const pixelWidth = Math.max(1, Math.round(width * dpr));
        const pixelHeight = Math.max(1, Math.round(height * dpr));

        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        state.particles.forEach((particle, index) => {
          if (previousWidth <= 0 || previousHeight <= 0 || !Number.isFinite(particle.x) || !Number.isFinite(particle.y)) {
            state.particles[index] = createParticle(width, height);
            return;
          }

          particle.x = clamp((particle.x / previousWidth) * width, 0, width);
          particle.y = clamp((particle.y / previousHeight) * height, 0, height);
        });
      }

      let lastTs = 0;
      function frame(ts) {
        const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
        if (isMobile) {
          canvas.style.display = "none";
          state.cssWidth = 0;
          state.cssHeight = 0;
          requestAnimationFrame(frame);
          return;
        }

        const layout = getCanvasLayout();
        syncCanvasSize(layout);

        if (ts - lastTs < 33) {
          requestAnimationFrame(frame);
          return;
        }

        lastTs = ts;
        const width = state.cssWidth;
        const height = state.cssHeight;
        const pts = state.particles;
        while (pts.length < particleCount) { pts.push(createParticle(width, height)); }

        if (width <= 0 || height <= 0) {
          requestAnimationFrame(frame);
          return;
        }

        ctx.clearRect(0, 0, width, height);

        pts.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
          p.x = clamp(p.x, 0, width);
          p.y = clamp(p.y, 0, height);
        });

        for (let i = 0; i < pts.length; i += 1) {
          for (let j = i + 1; j < pts.length; j += 1) {
            const dx = pts[i].x - pts[j].x;
            const dy = pts[i].y - pts[j].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < MAX_DIST) {
              ctx.beginPath();
              ctx.moveTo(pts[i].x, pts[i].y);
              ctx.lineTo(pts[j].x, pts[j].y);
              ctx.strokeStyle = `rgba(${particleColor}, ${((1 - d / MAX_DIST) * 0.25 * particleAlphaMult).toFixed(3)})`;
              ctx.lineWidth = 0.6;
              ctx.stroke();
            }
          }
        }

        pts.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${particleColor}, ${Math.min(1, 0.55 * particleAlphaMult).toFixed(3)})`;
          ctx.fill();
        });

        const holeWidth = Math.max(0, layout.hole.right - layout.hole.left);
        const holeHeight = Math.max(0, layout.hole.bottom - layout.hole.top);
        if (holeWidth > 0 && holeHeight > 0) {
          ctx.clearRect(layout.hole.left, layout.hole.top, holeWidth, holeHeight);
        }

        requestAnimationFrame(frame);
      }

      requestAnimationFrame(frame);
    })();

    (function initViewerCount() {
      if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;
      var WORKER_URL = "https://arbi-presence.7llewellyn.workers.dev";
      if (!WORKER_URL) return;
      var numEl = document.getElementById("viewerCountNum");
      var wrapEl = document.getElementById("viewerCount");
      var mobileNumEl = document.getElementById("mobileTopbarViewerNum");
      var mobileWrapEl = document.getElementById("mobileTopbarViewer");
      if (!numEl || !wrapEl) return;
      function createSessionId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          return window.crypto.randomUUID();
        }

        if (window.crypto && typeof window.crypto.getRandomValues === "function") {
          const bytes = new Uint8Array(16);
          window.crypto.getRandomValues(bytes);
          bytes[6] = (bytes[6] & 0x0f) | 0x40;
          bytes[8] = (bytes[8] & 0x3f) | 0x80;
          const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
          return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
        }

        return `sid-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      }
      var sid = sessionStorage.getItem("arbi_sid");
      if (!sid) {
        sid = createSessionId();
        sessionStorage.setItem("arbi_sid", sid);
      }
      function setCount(n) {
        numEl.textContent = n;
        wrapEl.classList.add("is-ready");
        if (mobileNumEl) mobileNumEl.textContent = n;
        if (mobileWrapEl) mobileWrapEl.classList.add("is-ready");
      }
      function sendPresence(body) {
        return fetch(WORKER_URL, {
          method: "POST",
          body: JSON.stringify(body)
        });
      }
      function beat() {
        sendPresence({ sid: sid })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(d) { if (d && typeof d.count === "number") setCount(d.count); })
          .catch(function() {  });
      }
      function sendLeave() {
        const body = JSON.stringify({ sid: sid, leave: true });
        if (navigator.sendBeacon) {
          try {
            const blob = new Blob([body], { type: "text/plain" });
            if (navigator.sendBeacon(WORKER_URL, blob)) return;
          } catch (e) {  }
        }
        fetch(WORKER_URL, { method: "POST", body: body, keepalive: true })
          .catch(function() {  });
      }
      const HEARTBEAT_INTERVAL_MS = 60 * 1000;
      let presenceTimer = null;

      function clearPresenceTimer() {
        if (presenceTimer !== null) {
          clearTimeout(presenceTimer);
          presenceTimer = null;
        }
      }

      function schedulePresenceTick(delayMs) {
        clearPresenceTimer();
        presenceTimer = setTimeout(runPresenceTick, Math.max(1000, delayMs));
      }

      function runPresenceTick() {
        presenceTimer = null;
        beat();
        schedulePresenceTick(HEARTBEAT_INTERVAL_MS);
      }

      function resumePresence() {
        clearPresenceTimer();
        runPresenceTick();
      }

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          resumePresence();
        }
      });
      window.addEventListener("pagehide", () => {
        clearPresenceTimer();
        sendLeave();
      });
      window.addEventListener("pageshow", (event) => {
        if (event.persisted) resumePresence();
      });

      resumePresence();
    })();


[
  ["fontIncreaseBtn", () => { fontScale = Math.min(1.6, +(fontScale + .05).toFixed(2)); applyFontScale(); }],
  ["fontDecreaseBtn", () => { fontScale = Math.max(.7, +(fontScale - .05).toFixed(2)); applyFontScale(); }],
  ["spacingIncreaseBtn", () => { readingLineHeight = Math.min(1.9, +(readingLineHeight + .03).toFixed(2)); applyReadingLineHeight(); }],
  ["spacingDecreaseBtn", () => { readingLineHeight = Math.max(1.35, +(readingLineHeight - .03).toFixed(2)); applyReadingLineHeight(); }],
  ["resetControlsBtn", () => { stopWidthAdjust(); resetUserControls(); }]
].forEach(([id, action]) => {
  const button = document.getElementById(id);
  button.addEventListener("click", action);
  bindPressedState(button);
});
[["widthIncreaseBtn", 40], ["widthDecreaseBtn", -40]].forEach(([id, delta]) => {
  const button = document.getElementById(id);
  bindWidthHold(button, delta);
  bindPressedState(button);
  button.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); adjustContentWidth(delta); }
  });
});
window.addEventListener("pointerup", stopWidthAdjust);
window.addEventListener("blur", stopWidthAdjust);
[[searchPrevBtn, -1], [searchNextBtn, 1]].forEach(([button, direction]) => {
  button.addEventListener("click", () => handleSearchNavigation(direction));
  bindPressedState(button);
});
searchBox.addEventListener("input", () => {
  const term = getSearchTerm();
  if (term) scheduleSearchHighlight(term);
  else { cancelPendingSearch(); clearSearchHighlights(); }
});
searchBox.addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); handleSearchNavigation(event.shiftKey ? -1 : 1); }
  if (event.key === "Escape") { cancelPendingSearch(); searchBox.value = ""; clearSearchHighlights(); }
});
document.addEventListener("keydown", event => {
  if (event.key !== "/" || event.target.closest?.("input, textarea, select, [contenteditable]")) return;
  event.preventDefault();
  if (isMobileLayout()) openMobileSearch();
  else { searchBox.focus(); searchBox.select(); }
});
document.addEventListener("riven:render", () => {
  if (getSearchTerm()) scheduleSearchHighlight(getSearchTerm());
});
function updateMobileProgress() {
  const available = document.documentElement.scrollHeight - window.innerHeight;
  document.getElementById("mobileProgressBar").style.width = `${available > 0 ? Math.min(100, window.scrollY / available * 100) : 0}%`;
}
window.addEventListener("scroll", updateMobileProgress, {passive:true});
window.addEventListener("resize", () => {
  syncTopbarOffset(); syncBrandLinkAria(); updateMobileProgress();
  if (!isMobileLayout()) { closeMobileSidebar(); closeMobileSearch(); }
});
setupTopbarOffsetObserver();
setupMobileSidebar();
setupMobileSearch();
loadFontScale(); loadReadingLineHeight(); loadContentMaxWidth();
updateSearchCount(); updateMobileProgress();
