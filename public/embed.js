(function () {
  function decoratePreTagsInBlock(questionBlock) {
    const preTags = questionBlock.querySelectorAll('pre:not(#notice pre):not(.debugging pre)');

    preTags.forEach(pre => {
      if (pre.hasAttribute('data-decorated')) return;
      pre.setAttribute('data-decorated', 'true');

      const wrapper = document.createElement('div');
      wrapper.className = 'moodle-pre-wrapper';
      wrapper.style.position = 'relative';

      const style = window.getComputedStyle(pre);
      wrapper.style.marginTop = style.marginTop;
      wrapper.style.marginBottom = style.marginBottom;
      wrapper.style.fontSize = style.fontSize;
      pre.style.marginTop = '0';
      pre.style.marginBottom = '0';

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const btn = document.createElement('div');
      btn.textContent = 'Use';
      btn.style.cssText = 'position: absolute; right: 0.4em; bottom: 0.4em; z-index: 10; user-select: none; cursor: pointer; background: #0e639c; color: white; padding: 0.2em 0.6em; border-radius: 0.25em; font-family: sans-serif; font-size: 0.75em; line-height: 1.2; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.15); transition: background 0.2s;';

      btn.addEventListener('mouseenter', () => {
        if (btn.textContent === 'Use') btn.style.background = '#1177bb';
      });
      btn.addEventListener('mouseleave', () => {
        if (btn.textContent === 'Use') btn.style.background = '#0e639c';
      });
      btn.addEventListener('mousedown', (e) => e.preventDefault());

      btn.addEventListener('click', () => {
        const text = pre.innerText + '\n';
        const activeEl = document.activeElement;

        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).catch(err => console.error("[Moodle Decorator] Clipboard failed:", err));
        }

        if (activeEl && activeEl.tagName === 'IFRAME' && questionBlock.contains(activeEl)) {
          activeEl.contentWindow.postMessage({ type: 'INSERT_CONTENT', payload: { content: text } }, '*');
        } else if (activeEl && (activeEl.isContentEditable || ['TEXTAREA', 'INPUT'].includes(activeEl.tagName)) && questionBlock.contains(activeEl)) {
          if (activeEl.setRangeText) {
            activeEl.setRangeText(text, activeEl.selectionStart, activeEl.selectionEnd, 'end');
          } else if (document.execCommand) {
            document.execCommand('insertText', false, text);
          } else {
            activeEl.value += text;
          }
        }
        
        btn.textContent = 'Copied!';
        btn.style.background = '#4ec9b0';
        setTimeout(() => {
          btn.textContent = 'Use';
          btn.style.background = '#0e639c';
        }, 1200);
      });

      wrapper.appendChild(btn);
    });
  }

  // --- STRATEGIES ---

  // Strategy 1: Default Swap (Immediate replacement, no toggle)
  function applyDefaultSwap(embed, textarea, height, rows, origin, widgetBg) {
    if (textarea) {
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

    const container = document.createElement('div');
    container.className = 'lms-widget-container';
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = (height || 400) + 'px';
    container.style.transition = 'height 0.2s ease-out';
    embed.appendChild(container);

    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-lms-widget', 'true');
    iframe.setAttribute('width', '100%');
    iframe.setAttribute('height', height || 400);
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.outline = 'none';
    iframe.style.borderRadius = '4px';
    iframe.style.background = widgetBg;

    const rowsParam = rows > 0 ? `&rows=${rows}` : '';
    iframe.src = `${origin}/?sync=true${rowsParam}`;

    container.appendChild(iframe);
  }

  // Strategy 2: Toggle Overlay Strategy
  function applyToggleOverlay(embed, textarea, height, rows, origin, widgetBg) {
    if (!textarea) return applyDefaultSwap(embed, null, height, rows, origin, widgetBg);

    // Save dimensions
    const originalTextareaHeight = textarea.clientHeight;
    
    // Create UI container
    const uiWrapper = document.createElement('div');
    uiWrapper.className = 'lms-toggle-wrapper';
    uiWrapper.style.position = 'relative';
    uiWrapper.style.width = '100%';
    uiWrapper.style.transition = 'height 0.2s ease-out';
    
    // Toggle button (position absolute above the wrapper, or just static before it)
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.textContent = 'Switch to Raw Text';
    // We will place it top right, above the widget
    toggleBtn.style.cssText = 'position: absolute; right: 0; top: -30px; padding: 4px 10px; font-size: 12px; cursor: pointer; border-radius: 4px; border: 1px solid #ccc; background: #f9f9f9; color: #333; z-index: 10; transition: background 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
    
    // Container for the iframe (LMSWidgetManager requires this specific class)
    const container = document.createElement('div');
    container.className = 'lms-widget-container';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.transition = 'opacity 0.2s ease-out';
    
    // Move into wrapper
    const textareaParent = textarea.parentNode;
    textareaParent.insertBefore(uiWrapper, textarea);
    uiWrapper.appendChild(toggleBtn);
    
    // Textarea must be sibling to container inside the wrapper
    uiWrapper.appendChild(textarea);
    uiWrapper.appendChild(container);
    
    // Reset textarea styles to fill wrapper perfectly
    textarea.style.position = 'absolute';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '100%';
    textarea.style.height = '100%';
    textarea.style.boxSizing = 'border-box';
    textarea.style.margin = '0';
    textarea.style.transition = 'opacity 0.2s ease-out';

    // Prepare Iframe
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-lms-widget', 'true');
    iframe.setAttribute('width', '100%');
    iframe.setAttribute('height', height || 400);
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.outline = 'none';
    iframe.style.borderRadius = '4px';
    iframe.style.background = widgetBg;
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.transition = 'opacity 0.2s ease-out';
    
    const rowsParam = rows > 0 ? `&rows=${rows}` : '';
    iframe.src = `${origin}/?sync=true${rowsParam}`;
    container.appendChild(iframe);

    // Toggle State Management
    let viewMode = 'iframe'; // default
    try {
      viewMode = localStorage.getItem('py_ide_view_mode') || 'iframe';
    } catch (e) {}

    let iframeHeight = height || 400; // Track the height the iframe WANTS to be

    function updateView(animate = true) {
      if (!animate) {
        textarea.style.transition = 'none';
        iframe.style.transition = 'none';
        container.style.transition = 'none';
      } else {
        textarea.style.transition = 'opacity 0.2s ease-out';
        iframe.style.transition = 'opacity 0.2s ease-out';
        container.style.transition = 'height 0.2s ease-out';
      }

      // Force a reflow if we removed transitions
      if (!animate) void container.offsetHeight;

      if (viewMode === 'iframe') {
        toggleBtn.textContent = 'Switch to Raw Text';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        textarea.style.zIndex = '1';
        
        iframe.style.opacity = '1';
        iframe.style.pointerEvents = 'auto';
        iframe.style.zIndex = '2';
        
        container.style.height = iframeHeight + 'px';
      } else {
        toggleBtn.textContent = 'Switch to IDE';
        iframe.style.opacity = '0';
        iframe.style.pointerEvents = 'none';
        iframe.style.zIndex = '1';
        
        textarea.style.opacity = '1';
        textarea.style.pointerEvents = 'auto';
        textarea.style.zIndex = '2';
        
        // Textarea mode uses original textarea height
        container.style.height = originalTextareaHeight + 'px';
      }
    }

    // Set initial state without animation (but wait for iframe load to reveal it)
    // Actually, initially, let's keep the iframe invisible until loaded
    iframe.style.opacity = '0';
    textarea.style.opacity = '1'; // Show textarea while loading
    container.style.height = originalTextareaHeight + 'px';

    iframe.addEventListener('load', () => {
      // Once loaded, snap to preferred view state
      updateView(true);
    });

    toggleBtn.addEventListener('click', () => {
      viewMode = viewMode === 'iframe' ? 'textarea' : 'iframe';
      try {
        localStorage.setItem('py_ide_view_mode', viewMode);
      } catch (e) {}
      updateView(true);
    });

    // We also need to listen for SYNC_HEIGHT specifically for this container
    // The global listener will update iframe attribute, but we need to update container height if in iframe mode.
    iframe.addEventListener('load', () => {
        // Just in case height changes
        iframe.setAttribute('data-lms-toggle-instance', 'true');
    });

    // Provide a localized height updater callback attached to the iframe so the global listener can trigger it
    iframe.__updateToggleHeight = (newHeight) => {
        iframeHeight = newHeight;
        if (viewMode === 'iframe') {
            container.style.height = iframeHeight + 'px';
        }
    };
  }

  // --- MAIN INIT ---

  function initEmbeds() {
    const embeds = document.querySelectorAll('.python-ide-embed:not([data-initialized])');
    if (embeds.length === 0) return;

    const currentScript = document.currentScript;
    let origin = 'https://python-web-ide.pwlewis.workers.dev'; 
    if (currentScript && currentScript.src) {
      origin = new URL(currentScript.src).origin;
    }

    embeds.forEach(embed => {
      const questionBlock = embed.closest('.que, .moodle-question, .formulation, form') || embed.parentElement || document;
      decoratePreTagsInBlock(questionBlock);
    });

    console.log('[Embed] Starting embed process...');

    for (const embed of embeds) {
      if (embed.getAttribute('data-initialized')) continue;
      embed.setAttribute('data-initialized', 'true');

      const questionBlock = embed.closest('.que, .moodle-question, .formulation, form') || embed.parentElement || document;
      const textarea = questionBlock.querySelector('textarea');
      let height = embed.getAttribute('data-height');
      let rows = 0;

      if (textarea) {
        const attrRows = parseInt(textarea.getAttribute('rows') || '0', 10);
        if (attrRows > 0) {
          rows = Math.max(1, attrRows - 2);
        } else if (textarea.clientHeight > 100) {
          rows = Math.max(1, Math.round(textarea.clientHeight / 20) - 2);
        }

        if (!height) {
          if (textarea.clientHeight > 50) {
            height = textarea.clientHeight;
          } else if (rows >= 3) {
            height = Math.max(300, Math.round((rows + 2) * 21));
          }
        }
      }

      let savedTheme = 'dark';
      try {
        savedTheme = localStorage.getItem('py_ide_theme') || 'dark';
      } catch (e) {}
      const widgetBg = savedTheme === 'light' ? '#ffffff' : '#1e1e1e';

      // Decide strategy based on configuration (for now, default to toggle strategy)
      // A script attribute could configure this: <script src="..." data-strategy="toggle">
      let strategy = currentScript ? currentScript.getAttribute('data-strategy') : 'toggle';
      if (!strategy) strategy = 'toggle'; // Default to the new toggle plugin

      if (strategy === 'toggle') {
        applyToggleOverlay(embed, textarea, height, rows, origin, widgetBg);
      } else {
        applyDefaultSwap(embed, textarea, height, rows, origin, widgetBg);
      }
    }

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
                if (typeof iframe.__updateToggleHeight === 'function') {
                    iframe.__updateToggleHeight(newHeight);
                } else {
                    const container = iframe.closest('.lms-widget-container');
                    if (container) {
                      container.style.height = newHeight + 'px';
                    } else {
                      iframe.style.height = newHeight + 'px';
                    }
                }
              }
            });
          }
        }
      });
    }

    if (!window.LMSWidgetManager && !document.querySelector('script[src*="lms-widget-manager"]')) {
      const managerScript = document.createElement('script');
      managerScript.type = 'module';
      managerScript.src = 'https://python-web-ide.pages.dev/lms-widget-manager.es.js';
      document.head.appendChild(managerScript);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEmbeds);
  } else {
    initEmbeds();
  }
})();
