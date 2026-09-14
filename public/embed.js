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

      // Config reading
      let strategy = currentScript ? currentScript.getAttribute('data-strategy') : 'toggle';
      if (!strategy) strategy = 'toggle';

      let autoload = false;
      if (currentScript && currentScript.getAttribute('data-autoload') === 'true') {
        autoload = true;
      }

      if (strategy === 'toggle') {
        // We load the plugin if not loaded
        if (!window.LmsTogglePlugin) {
          const pluginScript = document.createElement('script');
          pluginScript.src = `${origin}/lms-toggle-plugin.js`;
          document.head.appendChild(pluginScript);
          
          pluginScript.onload = () => {
            window.LmsTogglePlugin.applyToggleOverlay(embed, textarea, height, rows, origin, widgetBg, autoload);
          };
        } else {
          window.LmsTogglePlugin.applyToggleOverlay(embed, textarea, height, rows, origin, widgetBg, autoload);
        }
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
