(function() {
  function decoratePreTags() {
    // Find all <pre> tags inside Moodle question blocks, or fallback to all pre tags if outside standard Moodle wrappers
    let preTags = document.querySelectorAll('.que pre, .formulation pre, .qtext pre, .moodle-question pre');
    if (preTags.length === 0) {
      preTags = document.querySelectorAll('pre:not(#notice pre):not(.debugging pre)');
    }

    preTags.forEach(pre => {
      if (pre.hasAttribute('data-decorated')) return;
      pre.setAttribute('data-decorated', 'true');

      // Create a wrapper to safely absolute-position the button over the pre (even if it scrolls)
      const wrapper = document.createElement('div');
      wrapper.className = 'moodle-pre-wrapper';
      wrapper.style.position = 'relative';

      // Copy margins so layout doesn't break
      const style = window.getComputedStyle(pre);
      wrapper.style.marginTop = style.marginTop;
      wrapper.style.marginBottom = style.marginBottom;
      pre.style.marginTop = '0';
      pre.style.marginBottom = '0';

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // Create a button wrapper
      const btn = document.createElement('div');
      btn.textContent = 'Copy to Editor';
      btn.style.cssText = 'position: absolute; right: 0.5em; bottom: 0.5em; z-index: 10; user-select: none; cursor: pointer; background: #0e639c; color: white; padding: 0.4em 1em; border-radius: 0.3em; font-family: sans-serif; font-size: 0.85em; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.15); transition: background 0.2s;';

      // Prevent focus loss when clicking the button
      btn.addEventListener('mousedown', (e) => e.preventDefault());

      btn.addEventListener('click', () => {
        const text = pre.innerText + '\n';
        const activeEl = document.activeElement;

        // 1. Unconditionally write to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(err => console.error("[Moodle Decorator] Clipboard failed:", err));
        }

        // 2. Attempt live insertion
        if (activeEl && activeEl.tagName === 'IFRAME') {
            console.log('[Moodle Decorator] Sending code to active iframe');
            activeEl.contentWindow.postMessage({ type: 'INSERT_CONTENT', payload: { content: text } }, '*');
        } else if (activeEl && (activeEl.isContentEditable || ['TEXTAREA', 'INPUT'].includes(activeEl.tagName))) {
            console.log('[Moodle Decorator] Inserting code into active element');
            if (activeEl.setRangeText) {
                activeEl.setRangeText(text, activeEl.selectionStart, activeEl.selectionEnd, 'end');
            } else if (document.execCommand) {
                document.execCommand('insertText', false, text);
            } else {
                activeEl.value += text;
            }
        }
        // Visual feedback
        const oldText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = '#4ec9b0';
        setTimeout(() => {
          btn.textContent = oldText;
          btn.style.background = '#0e639c';
        }, 1500);
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
      
      // Determine height: First check data-height, then try to match Moodle textarea, finally fallback to 400
      let height = embed.getAttribute('data-height');
      if (!height) {
        // Find the parent Moodle question container (usually .que or .formulation)
        const questionContainer = embed.closest('.que, .formulation, form') || document;
        const textarea = questionContainer.querySelector('textarea');
        if (textarea && textarea.clientHeight > 100) {
          height = textarea.clientHeight;
        } else {
          height = 400;
        }
      }
      
      // Build the standard lms-widget-container
      const container = document.createElement('div');
      container.className = 'lms-widget-container';
      
      // Build the iframe pointing to the IDE with sync enabled
      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-lms-widget', 'true');
      iframe.setAttribute('width', '100%');
      iframe.setAttribute('height', height);
      iframe.src = `${origin}/?sync=true`;
      
      container.appendChild(iframe);
      embed.appendChild(container);
    });

    // Decorate any pre elements on the page
    decoratePreTags();

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
