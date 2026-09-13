(function () {
  function decoratePreTagsInBlock(questionBlock) {
    const preTags = questionBlock.querySelectorAll('pre:not(#notice pre):not(.debugging pre)');

    preTags.forEach(pre => {
      if (pre.hasAttribute('data-decorated')) return;
      pre.setAttribute('data-decorated', 'true');

      // Create a wrapper to safely absolute-position the button over the pre (even if it scrolls)
      const wrapper = document.createElement('div');
      wrapper.className = 'moodle-pre-wrapper';
      wrapper.style.position = 'relative';

      // Copy margins and font-size so layout and button scale perfectly with the pre
      const style = window.getComputedStyle(pre);
      wrapper.style.marginTop = style.marginTop;
      wrapper.style.marginBottom = style.marginBottom;
      wrapper.style.fontSize = style.fontSize;
      pre.style.marginTop = '0';
      pre.style.marginBottom = '0';

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // Create a button wrapper
      const btn = document.createElement('div');
      btn.textContent = 'Use';
      // Compact size with font-size & padding relative to pre font size, preventing overflow when zoomed out
      btn.style.cssText = 'position: absolute; right: 0.4em; bottom: 0.4em; z-index: 10; user-select: none; cursor: pointer; background: #0e639c; color: white; padding: 0.2em 0.6em; border-radius: 0.25em; font-family: sans-serif; font-size: 0.75em; line-height: 1.2; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.15); transition: background 0.2s;';

      // Hover feedback
      btn.addEventListener('mouseenter', () => {
        if (btn.textContent === 'Use') btn.style.background = '#1177bb';
      });
      btn.addEventListener('mouseleave', () => {
        if (btn.textContent === 'Use') btn.style.background = '#0e639c';
      });

      // Prevent focus loss when clicking the button
      btn.addEventListener('mousedown', (e) => e.preventDefault());

      btn.addEventListener('click', () => {
        const text = pre.innerText + '\n';
        const activeEl = document.activeElement;

        // 1. Unconditionally write to clipboard
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).catch(err => console.error("[Moodle Decorator] Clipboard failed:", err));
        }

        // 2. Attempt live insertion scoped to this question block
        if (activeEl && activeEl.tagName === 'IFRAME' && questionBlock.contains(activeEl)) {
          console.log('[Moodle Decorator] Sending code to active iframe in this question block');
          activeEl.contentWindow.postMessage({ type: 'INSERT_CONTENT', payload: { content: text } }, '*');
        } else if (activeEl && (activeEl.isContentEditable || ['TEXTAREA', 'INPUT'].includes(activeEl.tagName)) && questionBlock.contains(activeEl)) {
          console.log('[Moodle Decorator] Inserting code into active element in this question block');
          if (activeEl.setRangeText) {
            activeEl.setRangeText(text, activeEl.selectionStart, activeEl.selectionEnd, 'end');
          } else if (document.execCommand) {
            document.execCommand('insertText', false, text);
          } else {
            activeEl.value += text;
          }
        }
        // Visual feedback
        btn.textContent = 'Copied!';
        btn.style.background = '#4ec9b0';
        setTimeout(() => {
          btn.textContent = 'Use';
          btn.style.background = '#0e639c';
        }, 1200);
      });

      // Insert button inside the wrapper, overlapping the <pre>
      wrapper.appendChild(btn);
    });
  }

  function initEmbeds() {
    // Find all placeholder divs that haven't been initialized yet
    const embeds = document.querySelectorAll('.python-ide-embed:not([data-initialized])');

    // Get the base URL of where this embed.js script is hosted (e.g., https://python-web-ide.pwlewis.workers.dev)
    const currentScript = document.currentScript;
    let origin = 'https://python-web-ide.pwlewis.workers.dev'; // fallback
    if (currentScript && currentScript.src) {
      origin = new URL(currentScript.src).origin;
    }

    embeds.forEach(embed => {
      embed.setAttribute('data-initialized', 'true');

      // Find the parent Moodle question container (usually .que, .moodle-question, or .formulation)
      const questionBlock = embed.closest('.que, .moodle-question, .formulation, form') || embed.parentElement || document;

      // 1. Find the textarea in this question block (if any), measure, and hide it first
      const textarea = questionBlock.querySelector('textarea');

      let height = embed.getAttribute('data-height');
      let rows = 0;
      if (textarea) {
        // Read Moodle's configured rows (e.g. rows="10")
        const attrRows = parseInt(textarea.getAttribute('rows') || '0', 10);
        if (attrRows > 0) {
          rows = attrRows;
        } else if (textarea.clientHeight > 100) {
          rows = Math.round(textarea.clientHeight / 20);
        }

        if (!height) {
          if (rows >= 3) {
            // Default: 115px chrome (toolbar + panel header + padding) + rows * 21px line height
            height = Math.max(300, 115 + Math.round(rows * 21));
          } else if (textarea.clientHeight > 100) {
            height = textarea.clientHeight + 80;
          }
        }

        // Hide the textbox immediately before the iframe is ever added to the DOM
        textarea.style.display = 'none';
        const answerBlock = textarea.closest('.answer');
        if (answerBlock) {
          answerBlock.style.display = 'none';
        }
      }
      if (!height) {
        height = 400;
      }

      // 2. Build the iframe with its exact height and smooth transition set upfront
      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-lms-widget', 'true');
      iframe.setAttribute('width', '100%');
      iframe.setAttribute('height', height);
      iframe.style.width = '100%';
      iframe.style.height = height + 'px';
      iframe.style.transition = 'height 0.2s ease-out';
      iframe.style.background = '#1e1e1e'; // Match IDE dark theme so no bright white flash occurs
      iframe.style.border = '1px solid #333';
      iframe.style.borderRadius = '4px';
      
      const rowsParam = rows > 0 ? `&rows=${rows}` : '';
      iframe.src = `${origin}/?sync=true${rowsParam}`;

      // 3. Now attach container and iframe after the textbox has been hidden
      const container = document.createElement('div');
      container.className = 'lms-widget-container';
      container.appendChild(iframe);
      embed.appendChild(container);

      // Decorate pre elements only in this question block
      decoratePreTagsInBlock(questionBlock);
    });

    // Listen for dynamic SYNC_HEIGHT requests (e.g., when font size changes)
    if (!window.__pythonIdeHeightListenerAttached) {
      window.__pythonIdeHeightListenerAttached = true;
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'SYNC_HEIGHT') {
          const newHeight = e.data.payload?.height || e.data.height;
          if (newHeight && typeof newHeight === 'number' && newHeight >= 200) {
            const iframes = document.querySelectorAll('iframe[data-lms-widget]');
            iframes.forEach(iframe => {
              if (iframe.contentWindow === e.source) {
                iframe.setAttribute('height', newHeight);
                iframe.style.height = newHeight + 'px';
              }
            });
          }
        }
      });
    }

    // Inject the LMS Widget Manager if it isn't already on the page
    if (!window.LMSWidgetManager && !document.querySelector('script[src*="lms-widget-manager"]')) {
      const managerScript = document.createElement('script');
      managerScript.type = 'module';
      managerScript.src = 'https://python-web-ide.pages.dev/lms-widget-manager.es.js';
      document.head.appendChild(managerScript);
    }
  }

  // Run the initialization as soon as the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEmbeds);
  } else {
    initEmbeds();
  }
})();
