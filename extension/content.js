// Content script for Open Claude in Firefox extension.
// Injected into every page. Provides:
// - Accessibility tree generation (read_page)
// - Element ref mapping with WeakRef (persistent across calls)
// - Form input handling
// - Page text extraction
// - Element finding by text/attributes

(function () {
  if (window.__openClaudeInFirefoxLoaded) return;
  window.__openClaudeInFirefoxLoaded = true;

  // --- Element reference map ---
  // Persistent ref IDs stored as WeakRefs so GC still works
  let refCounter = 0;
  const elementMap = {}; // refId -> WeakRef<Element>
  const reverseMap = new WeakMap(); // Element -> refId

  function getOrAssignRef(el) {
    const existing = reverseMap.get(el);
    if (existing && elementMap[existing]?.deref() === el) return existing;
    const ref = `ref_${++refCounter}`;
    elementMap[ref] = new WeakRef(el);
    reverseMap.set(el, ref);
    return ref;
  }

  function resolveRef(refId) {
    const wr = elementMap[refId];
    if (!wr) return null;
    const el = wr.deref();
    if (!el) {
      delete elementMap[refId];
      return null;
    }
    return el;
  }

  // --- ARIA role mapping ---
  const TAG_TO_ROLE = {
    a: "link",
    button: "button",
    input: "textbox",
    textarea: "textbox",
    select: "combobox",
    img: "img",
    h1: "heading",
    h2: "heading",
    h3: "heading",
    h4: "heading",
    h5: "heading",
    h6: "heading",
    nav: "navigation",
    main: "main",
    header: "banner",
    footer: "contentinfo",
    aside: "complementary",
    form: "form",
    table: "table",
    tr: "row",
    th: "columnheader",
    td: "cell",
    ul: "list",
    ol: "list",
    li: "listitem",
    dialog: "dialog",
    details: "group",
    summary: "button",
    progress: "progressbar",
    meter: "meter",
    video: "video",
    audio: "audio",
    section: "region",
    article: "article",
  };

  function getRole(el) {
    if (el.getAttribute("role")) return el.getAttribute("role");
    const tag = el.tagName.toLowerCase();
    if (tag === "input") {
      const type = (el.type || "text").toLowerCase();
      const typeRoles = {
        checkbox: "checkbox",
        radio: "radio",
        range: "slider",
        button: "button",
        submit: "button",
        reset: "button",
        search: "searchbox",
        number: "spinbutton",
      };
      return typeRoles[type] || "textbox";
    }
    return TAG_TO_ROLE[tag] || null;
  }

  // --- Accessible name ---
  function getAccessibleName(el) {
    // Priority: aria-label > aria-labelledby > placeholder > title > alt > label > text
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();

    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const names = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean);
      if (names.length) return names.join(" ");
    }

    if (el.placeholder) return el.placeholder.trim();
    if (el.title) return el.title.trim();
    if (el.alt) return el.alt.trim();

    // Associated <label>
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return label.textContent.trim();
    }
    if (el.closest("label")) {
      const labelText = el.closest("label").textContent.trim();
      if (labelText) return labelText;
    }

    // Direct text content (only for leaf-ish elements)
    const tag = el.tagName.toLowerCase();
    if (["a", "button", "h1", "h2", "h3", "h4", "h5", "h6", "li", "summary", "label", "th", "td", "span"].includes(tag)) {
      const text = el.textContent?.trim();
      if (text && text.length < 200) return text;
    }

    return "";
  }

  // --- Interactivity check ---
  function isInteractive(el) {
    const tag = el.tagName.toLowerCase();
    if (["a", "button", "input", "textarea", "select", "summary", "details"].includes(tag)) return true;
    if (el.getAttribute("role") && ["button", "link", "textbox", "checkbox", "radio", "tab", "menuitem", "switch", "combobox", "slider", "spinbutton", "searchbox", "option"].includes(el.getAttribute("role"))) return true;
    if (el.tabIndex >= 0) return true;
    if (el.onclick || el.getAttribute("onclick")) return true;
    if (el.contentEditable === "true") return true;
    return false;
  }

  // --- Visibility check ---
  function isVisible(el) {
    if (el.offsetParent === null && el.tagName.toLowerCase() !== "body" && getComputedStyle(el).position !== "fixed") return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return true;
  }

  // --- Accessibility tree generation ---
  function generateAccessibilityTree(options = {}) {
    const filter = options.filter || "all";
    const maxDepth = options.depth || 15;
    const maxChars = options.max_chars || 50000;
    const startRefId = options.ref_id || null;

    let output = "";
    let charCount = 0;
    let truncated = false;

    function append(text) {
      if (truncated) return false;
      if (charCount + text.length > maxChars) {
        output += text.substring(0, maxChars - charCount);
        output += "\n... (truncated)";
        truncated = true;
        return false;
      }
      output += text;
      charCount += text.length;
      return true;
    }

    function walk(el, depth, indent) {
      if (truncated) return;
      if (depth > maxDepth) return;
      if (!el || el.nodeType !== 1) return;

      const tag = el.tagName.toLowerCase();
      // Skip invisible, script, style, svg internals
      if (["script", "style", "noscript", "template"].includes(tag)) return;

      const role = getRole(el);
      const name = getAccessibleName(el);
      const interactive = isInteractive(el);
      const visible = isVisible(el);

      // Filter: if interactive-only mode, skip non-interactive non-container elements
      const isContainer = el.children.length > 0;
      if (filter === "interactive" && !interactive && !isContainer) return;

      const shouldShow =
        (filter === "all" && (role || name)) ||
        (filter === "interactive" && interactive);

      if (shouldShow && visible) {
        const ref = getOrAssignRef(el);
        let line = `${indent}`;

        if (role) line += `${role}`;
        if (name) line += ` "${name.substring(0, 100)}"`;
        line += ` [${ref}]`;

        // Extra info for specific elements
        if (tag === "a" && el.href) line += ` href="${el.href}"`;
        if (tag === "img" && el.src) line += ` src="${el.src.substring(0, 100)}"`;
        if (["input", "textarea"].includes(tag) && el.value) line += ` value="${el.value.substring(0, 100)}"`;
        if (tag === "input") line += ` type="${el.type || "text"}"`;
        if (el.getAttribute("aria-expanded")) line += ` expanded=${el.getAttribute("aria-expanded")}`;
        if (el.getAttribute("aria-checked")) line += ` checked=${el.getAttribute("aria-checked")}`;
        if (el.getAttribute("aria-selected")) line += ` selected=${el.getAttribute("aria-selected")}`;
        if (el.disabled) line += " disabled";

        // Select options
        if (tag === "select") {
          const opts = Array.from(el.options).map(
            (o) => `${o.selected ? "*" : " "}${o.value}="${o.textContent.trim()}"`
          );
          if (opts.length) line += ` options=[${opts.join(", ")}]`;
        }

        if (!append(line + "\n")) return;
      }

      // Recurse children (including shadow DOM)
      const nextIndent = shouldShow && visible ? indent + "  " : indent;
      if (el.shadowRoot) {
        for (const child of el.shadowRoot.children) {
          walk(child, depth + 1, nextIndent);
        }
      }
      for (const child of el.children) {
        walk(child, depth + 1, nextIndent);
      }
    }

    let root = document.body;
    if (startRefId) {
      const el = resolveRef(startRefId);
      if (el) root = el;
      else return `Error: ref_id "${startRefId}" not found or element was garbage collected.`;
    }

    walk(root, 0, "");
    return output;
  }

  // --- Page text extraction ---
  function getPageText() {
    const selectors = [
      "article",
      "main",
      '[class*="articleBody"]',
      '[class*="post-content"]',
      '[class*="entry-content"]',
      '[role="main"]',
      ".content",
      "#content",
    ];
    let source = null;
    for (const sel of selectors) {
      source = document.querySelector(sel);
      if (source) break;
    }
    if (!source) source = document.body;

    const title = document.title || "";
    const url = location.href;
    const tag = source.tagName.toLowerCase();

    // Clean text: remove script/style content, collapse whitespace
    const clone = source.cloneNode(true);
    clone.querySelectorAll("script, style, noscript, template, svg").forEach((el) => el.remove());
    const text = clone.textContent.replace(/\s+/g, " ").trim();

    return JSON.stringify({ title, url, sourceTag: tag, text: text.substring(0, 100000) });
  }

  // --- Element finding ---
  function findElements(query) {
    const q = query.toLowerCase();
    const results = [];

    // Collect all elements including those inside shadow roots
    function collectAll(root) {
      const elements = [];
      for (const el of root.querySelectorAll("*")) {
        elements.push(el);
        if (el.shadowRoot) {
          elements.push(...collectAll(el.shadowRoot));
        }
      }
      return elements;
    }

    const all = collectAll(document);

    for (const el of all) {
      if (results.length >= 20) break;
      if (!isVisible(el)) continue;

      const tag = el.tagName.toLowerCase();
      if (["script", "style", "noscript", "template"].includes(tag)) continue;

      const role = getRole(el) || "";
      const name = getAccessibleName(el) || "";
      const text = el.textContent?.trim()?.substring(0, 200) || "";
      const placeholder = el.placeholder || "";
      const ariaLabel = el.getAttribute("aria-label") || "";
      const title = el.title || "";
      const type = el.type || "";

      const searchable = `${role} ${name} ${text} ${placeholder} ${ariaLabel} ${title} ${type} ${tag}`.toLowerCase();

      if (searchable.includes(q)) {
        const ref = getOrAssignRef(el);
        const rect = el.getBoundingClientRect();
        results.push({
          ref,
          role: role || tag,
          name: name || text.substring(0, 80),
          coordinates: [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)],
        });
      }
    }
    return results;
  }

  // --- Form input ---

  // Find the actual input/textarea/select inside an element, traversing shadow DOM
  function findInputInside(el) {
    const tag = el.tagName.toLowerCase();
    if (["input", "textarea", "select"].includes(tag)) return el;

    // Check shadow DOM first
    const root = el.shadowRoot || el;
    const inner = root.querySelector("input, textarea, select");
    if (inner) return inner;

    // Recurse into shadow roots of children
    for (const child of root.querySelectorAll("*")) {
      if (child.shadowRoot) {
        const deep = child.shadowRoot.querySelector("input, textarea, select");
        if (deep) return deep;
      }
    }
    return null;
  }

  function setFormValue(refId, value) {
    const el = resolveRef(refId);
    if (!el) return { error: `Element ${refId} not found or was garbage collected.` };

    el.scrollIntoView({ block: "center", behavior: "instant" });

    // Resolve the actual form element (may be inside shadow DOM)
    const target = findInputInside(el) || el;
    const tag = target.tagName.toLowerCase();
    const type = (target.type || "").toLowerCase();

    if (tag === "select") {
      const opt = Array.from(target.options).find(
        (o) => o.value === String(value) || o.textContent.trim() === String(value)
      );
      if (opt) {
        target.value = opt.value;
      } else {
        target.value = String(value);
      }
    } else if (type === "checkbox" || type === "radio") {
      const shouldCheck = typeof value === "boolean" ? value : value === "true";
      if (target.checked !== shouldCheck) target.click();
      return { success: true, checked: target.checked };
    } else if (target.contentEditable === "true") {
      target.textContent = String(value);
    } else if (["input", "textarea"].includes(tag)) {
      // Use the native setter for actual input/textarea elements
      const proto = tag === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) {
        setter.call(target, String(value));
      } else {
        target.value = String(value);
      }
    } else {
      // Fallback for unknown elements — try direct assignment
      try {
        target.value = String(value);
      } catch {
        return { error: `Cannot set value on <${tag}> element. No input found inside.` };
      }
    }

    // Dispatch events on the target (bubbles up through shadow DOM)
    target.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    target.dispatchEvent(new Event("change", { bubbles: true, composed: true }));

    return { success: true, value: target.value };
  }

  // --- Get element coordinates for ref ---
  function getRefCoordinates(refId) {
    const el = resolveRef(refId);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: Math.round(rect.x + rect.width / 2),
      y: Math.round(rect.y + rect.height / 2),
    };
  }

  // --- Helper for synthetic events ---
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // --- Message handler ---
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "generateAccessibilityTree") {
      const result = generateAccessibilityTree(msg.options || {});
      sendResponse({ result });
      return true;
    }

    if (msg.type === "getPageText") {
      const result = getPageText();
      sendResponse({ result });
      return true;
    }

    if (msg.type === "findElements") {
      const result = findElements(msg.query);
      sendResponse({ result });
      return true;
    }

    if (msg.type === "setFormValue") {
      const result = setFormValue(msg.ref, msg.value);
      sendResponse({ result });
      return true;
    }

    if (msg.type === "getRefCoordinates") {
      const result = getRefCoordinates(msg.ref);
      sendResponse({ result });
      return true;
    }

    // --- Input event dispatchers (Firefox replacement for CDP Input.*) ---

    if (msg.type === "dispatchMouseClick") {
      const { x, y, button, clickCount, modifiers } = msg;
      const el = document.elementFromPoint(x, y) || document.body;
      const buttonMap = { left: 0, middle: 1, right: 2 };
      const btn = buttonMap[button ?? "left"] ?? 0;
      const btns = btn === 0 ? 1 : btn === 1 ? 4 : 2;
      const shared = {
        bubbles: true, cancelable: true, view: window,
        clientX: x, clientY: y, button: btn,
        ctrlKey: !!(modifiers & 2), altKey: !!(modifiers & 1),
        shiftKey: !!(modifiers & 8), metaKey: !!(modifiers & 4),
      };
      el.dispatchEvent(new MouseEvent("mousemove", { ...shared, buttons: 0, detail: 0 }));
      el.dispatchEvent(new MouseEvent("mousedown", { ...shared, buttons: btns, detail: 1 }));
      if (typeof el.focus === "function") el.focus({ preventScroll: true });
      el.dispatchEvent(new MouseEvent("mouseup", { ...shared, buttons: 0, detail: 1 }));
      if (button === "right") {
        el.dispatchEvent(new MouseEvent("contextmenu", { ...shared, buttons: 0, detail: 0 }));
      } else if (button !== "middle") {
        for (let i = 0; i < (clickCount || 1); i++) {
          el.dispatchEvent(new MouseEvent("click", { ...shared, buttons: 0, detail: i + 1 }));
        }
        if ((clickCount || 1) >= 2) {
          el.dispatchEvent(new MouseEvent("dblclick", { ...shared, buttons: 0, detail: 2 }));
        }
      }
      sendResponse({});
      return true;
    }

    if (msg.type === "dispatchMouseMove") {
      const el = document.elementFromPoint(msg.x, msg.y) || document.body;
      el.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true, cancelable: true, view: window,
        clientX: msg.x, clientY: msg.y, buttons: 0,
        ctrlKey: !!(msg.modifiers & 2), altKey: !!(msg.modifiers & 1),
        shiftKey: !!(msg.modifiers & 8), metaKey: !!(msg.modifiers & 4),
      }));
      sendResponse({});
      return true;
    }

    if (msg.type === "dispatchKeyEvent") {
      const keyType = msg.eventType === "keyDown" ? "keydown" : "keyup";
      const el = document.activeElement || document.body;
      el.dispatchEvent(new KeyboardEvent(keyType, {
        bubbles: true, cancelable: true, view: window,
        key: msg.key, code: msg.code, repeat: false,
        ctrlKey: !!(msg.modifiers & 2), altKey: !!(msg.modifiers & 1),
        shiftKey: !!(msg.modifiers & 8), metaKey: !!(msg.modifiers & 4),
      }));
      sendResponse({});
      return true;
    }

    if (msg.type === "insertText") {
      const el = document.activeElement;
      if (el) {
        const tag = el.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea") {
          const start = el.selectionStart ?? el.value.length;
          const end = el.selectionEnd ?? el.value.length;
          const proto = tag === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          const newVal = el.value.slice(0, start) + msg.text + el.value.slice(end);
          if (setter) setter.call(el, newVal); else el.value = newVal;
          el.selectionStart = el.selectionEnd = start + msg.text.length;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (el.isContentEditable) {
          document.execCommand("insertText", false, msg.text);
        }
      }
      sendResponse({});
      return true;
    }

    if (msg.type === "dispatchScroll") {
      const el = document.elementFromPoint(msg.x, msg.y) || document.documentElement;
      el.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true, cancelable: true, view: window,
        clientX: msg.x, clientY: msg.y,
        deltaX: msg.deltaX || 0, deltaY: msg.deltaY || 0,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
        ctrlKey: !!(msg.modifiers & 2), altKey: !!(msg.modifiers & 1),
        shiftKey: !!(msg.modifiers & 8), metaKey: !!(msg.modifiers & 4),
      }));
      // Also scroll the container for compatibility
      if (el !== document.documentElement && el !== document.body) {
        el.scrollBy({ left: msg.deltaX || 0, top: msg.deltaY || 0, behavior: "auto" });
      } else {
        window.scrollBy({ left: msg.deltaX || 0, top: msg.deltaY || 0, behavior: "auto" });
      }
      sendResponse({});
      return true;
    }

    if (msg.type === "scrollToRef") {
      const el = resolveRef(msg.ref);
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      sendResponse({});
      return true;
    }

    if (msg.type === "scrollToPosition") {
      window.scrollTo(msg.x, msg.y);
      sendResponse({});
      return true;
    }

    if (msg.type === "dispatchDrag") {
      (async () => {
        const { startX, startY, endX, endY, modifiers } = msg;
        const getEl = (x, y) => document.elementFromPoint(x, y) || document.body;
        const dispatch = (el, type, x, y, buttons) => {
          el.dispatchEvent(new MouseEvent(type, {
            bubbles: true, cancelable: true, view: window,
            clientX: x, clientY: y, button: 0, buttons,
            ctrlKey: !!(modifiers & 2), altKey: !!(modifiers & 1),
            shiftKey: !!(modifiers & 8), metaKey: !!(modifiers & 4),
          }));
        };
        dispatch(getEl(startX, startY), "mousemove", startX, startY, 0);
        await sleep(50);
        dispatch(getEl(startX, startY), "mousedown", startX, startY, 1);
        await sleep(50);
        const steps = 10;
        for (let i = 1; i <= steps; i++) {
          const mx = startX + ((endX - startX) * i) / steps;
          const my = startY + ((endY - startY) * i) / steps;
          dispatch(getEl(mx, my), "mousemove", mx, my, 1);
          await sleep(20);
        }
        dispatch(getEl(endX, endY), "mouseup", endX, endY, 0);
        sendResponse({});
      })();
      return true;
    }

    return false;
  });

  // Expose globally for executeScript (scripting.executeScript MAIN world access)
  window.__openClaudeInFirefox = {
    generateAccessibilityTree,
    getPageText,
    findElements,
    setFormValue,
    getRefCoordinates,
    resolveRef,
    elementMap,
  };
})();
