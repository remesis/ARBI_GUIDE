const EXPORT_HTML_PATH = "./export/WarframeArbitrationsGuide.html";

let searchHits = [];
let currentSearchIndex = -1;
let observer = null;

async function loadGuide() {
  const content = document.getElementById("content");

  try {
    const response = await fetch(EXPORT_HTML_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load export HTML (${response.status})`);
    }

    const rawHtml = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    rewriteRelativeImages(doc);
    removeJunk(doc);

    const outline = extractHeadings(doc);

    content.innerHTML = `<div class="google-export">${doc.body.innerHTML}</div>`;

    buildSidebar(outline);
    setupSectionObserver();
    setupImages();
  } catch (error) {
    console.error(error);
    content.innerHTML = `<p>Failed to load the guide content.</p>`;
  }
}

function rewriteRelativeImages(doc) {
  doc.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src) return;

    if (/^(https?:|data:)/i.test(src)) return;

    img.setAttribute("src", `./export/${src.replace(/^\.?\//, "")}`);
  });
}

function removeJunk(doc) {
  doc.querySelectorAll("script, noscript, meta, link").forEach((el) => el.remove());
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function extractHeadings(doc) {
  const headings = Array.from(doc.body.querySelectorAll("h1, h2, h3"));
  const used = new Set();

  return headings.map((heading, index) => {
    let id = heading.id?.trim() || slugify(heading.textContent) || `section-${index}`;
    while (used.has(id)) {
      id += "-x";
    }
    used.add(id);
    heading.id = id;

    return {
      id,
      text: heading.textContent.trim(),
      depth: heading.tagName === "H1" ? 0 : heading.tagName === "H2" ? 1 : 2
    };
  });
}

function buildSidebar(outline) {
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML = "";

  outline.forEach((item) => {
    const link = document.createElement("a");
    link.href = `#${item.id}`;
    link.textContent = item.text;
    link.className = `depth-${item.depth}`;

    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = document.getElementById(item.id);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    sidebar.appendChild(link);
  });
}

function setupSectionObserver() {
  const links = Array.from(document.querySelectorAll("#sidebar a"));
  const targets = links
    .map((link) => {
      const id = link.getAttribute("href")?.slice(1);
      const target = document.getElementById(id);
      if (!target) return null;
      return { link, target };
    })
    .filter(Boolean);

  if (observer) observer.disconnect();

  observer = new IntersectionObserver(
    (entries) => {
      let best = null;

      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (!best || entry.boundingClientRect.top < best.boundingClientRect.top) {
          best = entry;
        }
      }

      if (!best) return;

      links.forEach((link) => link.classList.remove("active"));

      const match = targets.find((item) => item.target === best.target);
      if (match) {
        match.link.classList.add("active");
      }
    },
    {
      rootMargin: "-18% 0px -68% 0px",
      threshold: [0, 1]
    }
  );

  targets.forEach((item) => observer.observe(item.target));
}

function setupImages() {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");

  document.querySelectorAll("#content img").forEach((img) => {
    img.addEventListener("click", () => {
      lightboxImg.src = img.src;
      lightbox.hidden = false;
    });
  });

  lightbox.addEventListener("click", () => {
    lightbox.hidden = true;
    lightboxImg.removeAttribute("src");
  });
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
}

function highlightSearch(term) {
  clearSearchHighlights();
  if (!term.trim()) return;

  const root = document.getElementById("content");
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "gi");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  const textNodes = [];
  let node;

  while ((node = walker.nextNode())) {
    if (!node.nodeValue.trim()) continue;

    const parentName = node.parentNode?.nodeName?.toLowerCase();
    if (["script", "style", "mark"].includes(parentName)) continue;

    if (regex.test(node.nodeValue)) {
      textNodes.push(node);
    }
    regex.lastIndex = 0;
  }

  for (const textNode of textNodes) {
    const text = textNode.nodeValue;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
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
    regex.lastIndex = 0;
  }
}

function goToSearchHit(direction) {
  const term = document.getElementById("searchBox").value;
  if (!term.trim()) return;

  if (searchHits.length === 0) {
    highlightSearch(term);
  }

  if (searchHits.length === 0) return;

  currentSearchIndex = (currentSearchIndex + direction + searchHits.length) % searchHits.length;
  const hit = searchHits[currentSearchIndex];
  hit.scrollIntoView({ behavior: "smooth", block: "center" });
}

function bindSearch() {
  document.getElementById("searchNextBtn").addEventListener("click", () => goToSearchHit(1));
  document.getElementById("searchPrevBtn").addEventListener("click", () => goToSearchHit(-1));

  document.getElementById("searchBox").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      goToSearchHit(1);
    }
  });

  document.getElementById("searchBox").addEventListener("input", () => {
    clearSearchHighlights();
  });
}

bindSearch();
loadGuide();