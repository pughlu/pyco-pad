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

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function initEmbeds() {
    // Find all placeholder divs that haven't been initialized yet
    const embeds = document.querySelectorAll('.python-ide-embed:not([data-initialized])');
    if (embeds.length === 0) return;

    // Get the base URL of where this embed.js script is hosted (e.g., https://python-web-ide.pwlewis.workers.dev)
    const currentScript = document.currentScript;
    let origin = 'https://python-web-ide.pwlewis.workers.dev'; // fallback
    if (currentScript && currentScript.src) {
      origin = new URL(currentScript.src).origin;
    }

    // Step 0: Decorate pre code tags immediately so copy buttons are active
    embeds.forEach(embed => {
      const questionBlock = embed.closest('.que, .moodle-question, .formulation, form') || embed.parentElement || document;
      decoratePreTagsInBlock(questionBlock);
    });

    // Step 1: "Wait 3 secs before loading script"
    console.log('[Embed] Waiting 3 seconds before starting embed process...');
    await delay(3000);

    for (const embed of embeds) {
      if (embed.getAttribute('data-initialized')) continue;
      embed.setAttribute('data-initialized', 'true');

      // Find the parent Moodle question container (usually .que, .moodle-question, or .formulation)
      const questionBlock = embed.closest('.que, .moodle-question, .formulation, form') || embed.parentElement || document;

      // Determine height based on Moodle textarea / configured rows
      const textarea = questionBlock.querySelector('textarea');
      let height = embed.getAttribute('data-height');
      let rows = 0;

      if (textarea) {
        const attrRows = parseInt(textarea.getAttribute('rows') || '0', 10);
        if (attrRows > 0) {
          rows = attrRows;
        } else if (textarea.clientHeight > 100) {
          rows = Math.round(textarea.clientHeight / 20);
        }

        if (!height) {
          if (rows >= 3) {
            height = Math.max(300, 115 + Math.round(rows * 21));
          } else if (textarea.clientHeight > 100) {
            height = textarea.clientHeight + 80;
          }
        }

        // Step 2: "First thing script should do is 'hide' answerbox and replace with plain grey placeholder div"
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        textarea.tabIndex = -1;

        const answerBlock = textarea.closest('.answer');
        if (answerBlock) {
          answerBlock.style.display = 'none';
        }
      }

      if (!height) {
        height = 400;
      }

      // Container for widget & placeholder
      const container = document.createElement('div');
      container.className = 'lms-widget-container';
      container.style.position = 'relative';
      container.style.width = '100%';
      container.style.height = height + 'px';
      container.style.transition = 'height 0.2s ease-out';
      embed.appendChild(container);

      // Plain grey placeholder div with 1s fade-in
      const placeholder = document.createElement('div');
      placeholder.className = 'lms-widget-placeholder';
      placeholder.style.width = '100%';
      placeholder.style.height = '100%';
      placeholder.style.background = '#2e2e2e'; // Plain grey
      placeholder.style.border = '1px solid #444';
      placeholder.style.borderRadius = '4px';
      placeholder.style.boxSizing = 'border-box';
      placeholder.style.opacity = '0';
      placeholder.style.transition = 'opacity 1s ease-in-out';
      placeholder.style.position = 'absolute';
      placeholder.style.top = '0';
      placeholder.style.left = '0';
      placeholder.style.zIndex = '1';
      container.appendChild(placeholder);

      // Trigger 1-second fade in for the placeholder
      requestAnimationFrame(() => {
        placeholder.style.opacity = '1';
      });

      // Step 3: "Wait 3 secs"
      console.log('[Embed] Placeholder displayed. Waiting 3 seconds before preparing iframe...');
      await delay(3000);

      // Step 4: "Prepare iframe (outside of DOM?)"
      // In browser DOM standards, an iframe must be attached to the DOM to trigger network requests and execution.
      // We attach it inside container behind the placeholder with opacity: 0 and pointerEvents: none.
      console.log('[Embed] Preparing iframe in background...');
      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-lms-widget', 'true');
      iframe.setAttribute('width', '100%');
      iframe.setAttribute('height', height);
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = '1px solid #333';
      iframe.style.borderRadius = '4px';
      iframe.style.background = '#1e1e1e';
      iframe.style.opacity = '0';
      iframe.style.position = 'absolute';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.zIndex = '2';
      iframe.style.pointerEvents = 'none';
      iframe.style.transition = 'opacity 1s ease-in-out';

      const rowsParam = rows > 0 ? `&rows=${rows}` : '';
      iframe.src = `${origin}/?sync=true${rowsParam}`;

      container.appendChild(iframe);

      // Step 5: "When iframe is ready swap it for the placeholder. Each transition should be a 1sec fade"
      let swapped = false;
      const swapForPlaceholder = () => {
        if (swapped) return;
        swapped = true;
        console.log('[Embed] Iframe ready. Swapping with 1-second fade...');
        placeholder.style.opacity = '0';
        iframe.style.opacity = '1';
        iframe.style.pointerEvents = 'auto';

        setTimeout(() => {
          if (placeholder.parentNode) {
            placeholder.parentNode.removeChild(placeholder);
          }
        }, 1000);
      };

      iframe.addEventListener('load', swapForPlaceholder);
      // Safety fallback in case load event already fired or is delayed
      setTimeout(swapForPlaceholder, 4000);
    }

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
                const container = iframe.closest('.lms-widget-container');
                if (container) {
                  container.style.height = newHeight + 'px';
                } else {
                  iframe.style.height = newHeight + 'px';
                }
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
