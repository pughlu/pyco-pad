(function () {
  const currentScript = document.currentScript;
  let defaultOrigin = 'https://pyco-pad.pages.dev';
  if (currentScript && currentScript.src) {
    try {
      defaultOrigin = new URL(currentScript.src).origin;
    } catch (e) { }
  }

  // --- CONFIGURATION ---
  // You can easily edit these user-facing strings here. They will be shared across all widgets and plugins.
  window.PYTHON_IDE_STRINGS = window.PYTHON_IDE_STRINGS || {
    useCodeBtn: 'Use',
    switchToTextEditorBtn: 'Switch to Text Editor',
    switchToIdeBtn: 'Switch to Python Code Editor',
    dragToResizeTitle: 'Drag to resize editor',
  };

  // Centralized LMS Widget Manager CDN configuration
  const DEFAULT_LMS_WIDGET_MANAGER_URL = new URL('lms-widget-manager.iife.js', defaultOrigin).href;
  const lmsWidgetManagerUrl = window.LMS_WIDGET_MANAGER_URL ||
    (currentScript && (currentScript.getAttribute('data-widget-manager-url') || currentScript.getAttribute('data-manager-url'))) ||
    DEFAULT_LMS_WIDGET_MANAGER_URL;
  window.LMS_WIDGET_MANAGER_URL = lmsWidgetManagerUrl;

  function loadLMSWidgetManager() {
    if (window.LMSWidgetManager) {
      return Promise.resolve(window.LMSWidgetManager);
    }

    return new Promise((resolve, reject) => {
      // Check if script tag is already in the document
      const existing = document.querySelector('script[data-lms-manager]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.LMSWidgetManager));
        existing.addEventListener('error', reject);
        return;
      }

      const script = document.createElement('script');
      script.setAttribute('data-lms-manager', 'true');
      script.src = window.LMS_WIDGET_MANAGER_URL || DEFAULT_LMS_WIDGET_MANAGER_URL;
      script.onload = () => resolve(window.LMSWidgetManager);
      script.onerror = (err) => reject(new Error('Failed to load LMSWidgetManager: ' + err));
      document.head.appendChild(script);
    });
  }
  window.loadLMSWidgetManager = loadLMSWidgetManager;


  // --- STRATEGIES ---

  // Strategy 1: Default Swap (Immediate replacement, no toggle)
  function applyDefaultSwap(embed, textarea, height, rows, origin, widgetBg, starterCode) {
    if (textarea && starterCode && !textarea.value) {
      textarea.value = starterCode;
    }
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
    container.setAttribute('data-widget-origin', '*');
    container.setAttribute('data-origin', '*');
    if (textarea) {
      if (textarea.id) container.setAttribute('data-lms-target-textarea', '#' + textarea.id);
      if (textarea.name) container.setAttribute('data-lms-textarea-name', textarea.name);
    }
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = (height || 400) + 'px';
    embed.appendChild(container);

    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-lms-widget', 'true');
    iframe.setAttribute('width', '100%');
    iframe.setAttribute('height', height || 400);
    iframe.style.width = '100%';
    iframe.style.border = 'none';
    iframe.style.outline = 'none';
    iframe.style.borderRadius = '4px';
    iframe.style.background = widgetBg;

    const rowsParam = rows > 0 ? `&rows=${rows}` : '';
    iframe.src = `${origin}/?sync=true${rowsParam}`;

    container.appendChild(iframe);

    // Resize Handle (Lower RHS, textarea style)
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'lms-widget-resize-handle';
    resizeHandle.title = window.PYTHON_IDE_STRINGS.dragToResizeTitle;
    resizeHandle.style.cssText = 'position: absolute; right: 2px; bottom: 2px; width: 16px; height: 16px; cursor: se-resize; z-index: 25; opacity: 0.5; transition: opacity 0.2s; user-select: none; touch-action: none;';
    resizeHandle.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block; pointer-events: none;">
        <path d="M12 4L4 12M12 8L8 12M12 12L12 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
    `;
    resizeHandle.style.color = widgetBg === '#ffffff' ? '#666' : '#bbb';
    resizeHandle.addEventListener('mouseenter', () => { resizeHandle.style.opacity = '1'; });
    resizeHandle.addEventListener('mouseleave', () => { resizeHandle.style.opacity = '0.5'; });
    container.appendChild(resizeHandle);

    let isDragging = false;
    let startY = 0;
    let startHeight = 0;

    resizeHandle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      iframe.__isManuallyResized = true;
      startY = e.clientY;
      startHeight = container.offsetHeight;
      try {
        resizeHandle.setPointerCapture(e.pointerId);
      } catch (err) { }

      iframe.style.pointerEvents = 'none';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEvt) => {
        if (!isDragging) return;
        const deltaY = moveEvt.clientY - startY;
        const newHeight = Math.max(180, Math.round(startHeight + deltaY));
        container.style.height = newHeight + 'px';
        iframe.style.height = newHeight + 'px';
        iframe.setAttribute('height', newHeight);
      };

      const onPointerUp = () => {
        if (!isDragging) return;
        isDragging = false;
        try {
          resizeHandle.releasePointerCapture(e.pointerId);
        } catch (err) { }
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        iframe.style.pointerEvents = 'auto';
        document.body.style.removeProperty('user-select');
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    // Notify LMSWidgetManager that a new container is mounted (decoupled handshake)
    container.dispatchEvent(new CustomEvent('lms-widget:mount', {
      bubbles: true,
      detail: { container: container }
    }));

    // Ensure the external LMSWidgetManager module is loaded
    loadLMSWidgetManager();
  }



  // --- MAIN INIT ---

  function initEmbeds() {
    // Find traditional div embeds AND single-script embeds AND pyco-pad elements
    const embedTargets = document.querySelectorAll('.python-ide-embed:not([data-initialized]), script[data-create-pad]:not([data-initialized]), pyco-pad:not([data-initialized])');
    if (embedTargets.length === 0) return;

    let origin = defaultOrigin;
    const scriptRef = currentScript || document.currentScript;
    if (scriptRef && scriptRef.src) {
      try {
        origin = new URL(scriptRef.src).origin;
      } catch (e) { }
    }

    const embeds = [];

    embedTargets.forEach(target => {
      target.setAttribute('data-initialized', 'true');

      let embed = target;
      let starterCode = '';
      
      if (target.tagName.toLowerCase() === 'pyco-pad') {
        starterCode = target.textContent.trim();
        embed = document.createElement('div');
        embed.className = 'python-ide-embed';
        embed.setAttribute('data-initialized', 'true');
        
        Array.from(target.attributes).forEach(attr => {
          if (attr.name !== 'data-initialized') embed.setAttribute(attr.name, attr.value);
        });
        target.parentNode.insertBefore(embed, target);
        target.remove();
      } else if (target.tagName.toLowerCase() === 'script') {
        embed = document.createElement('div');
        embed.className = 'python-ide-embed';
        embed.setAttribute('data-initialized', 'true');

        Array.from(target.attributes).forEach(attr => {
          if (attr.name.startsWith('data-') && attr.name !== 'data-initialized' && attr.name !== 'data-create-pad') {
            embed.setAttribute(attr.name, attr.value);
          }
        });
        target.parentNode.insertBefore(embed, target);
      }

      embed._starterCode = starterCode;
      embeds.push(embed);
    });

    console.log('[Embed] Starting embed process...');

    for (const embed of embeds) {

      const questionBlock = embed.closest('.que, .moodle-question, .formulation, form') || embed.parentElement || document;
      const textarea = questionBlock.querySelector('textarea');
      let height = embed.getAttribute('data-height');
      let rows = 0;

      if (textarea) {
        const attrRows = parseInt(textarea.getAttribute('rows') || '0', 10);
        if (attrRows > 0) {
          rows = attrRows;
        } else if (textarea.clientHeight > 50) {
          rows = Math.max(3, Math.round(textarea.clientHeight / 24));
        }

        if (!height) {
          const headerAllowance = 115; // 40px toolbar + 35px header + 30px padding + 10px buffer
          if (textarea.clientHeight > 50) {
            height = textarea.clientHeight + headerAllowance;
          } else if (rows > 0) {
            height = Math.max(320, Math.round(headerAllowance + (rows * 24)));
          } else {
            height = 400;
          }
        }
      }

      let savedTheme = 'dark';
      try {
        savedTheme = localStorage.getItem('py_ide_theme') || 'dark';
      } catch (e) { }
      const widgetBg = savedTheme === 'light' ? '#ffffff' : '#1e1e1e';

      // Config reading
      let strategy = currentScript ? currentScript.getAttribute('data-strategy') : 'toggle';
      if (!strategy) strategy = 'toggle';

      let autoload = false;
      if (currentScript && currentScript.getAttribute('data-autoload') === 'true') {
        autoload = true;
      }

      if (strategy === 'toggle') {
        if (!window.LmsTogglePlugin) {
          // If we haven't started loading the plugin yet, start now.
          if (!window._lmsTogglePluginLoading) {
            window._lmsTogglePluginLoading = [];
            const pluginScript = document.createElement('script');

            // Resolve relative to embed.js path
            let pluginUrl = `${origin}/lms-toggle-plugin.js`;
            if (currentScript && currentScript.src) {
              try {
                const urlObj = new URL(currentScript.src);
                const pathParts = urlObj.pathname.split('/');
                pathParts[pathParts.length - 1] = 'lms-toggle-plugin.js';
                urlObj.pathname = pathParts.join('/');
                pluginUrl = urlObj.href;
              } catch (e) { }
            }

            pluginScript.src = pluginUrl;
            document.head.appendChild(pluginScript);

            pluginScript.onload = () => {
              if (window._lmsTogglePluginLoading) {
                window._lmsTogglePluginLoading.forEach(cb => cb());
                window._lmsTogglePluginLoading = null;
              }
            };
            pluginScript.onerror = () => {
              console.error("[Embed] Failed to load toggle plugin from", pluginUrl);
              if (window._lmsTogglePluginLoading) {
                window._lmsTogglePluginLoading.forEach(cb => cb(true));
                window._lmsTogglePluginLoading = null;
              }
            };
          }

          // Queue this embed to initialize once the plugin loads
          window._lmsTogglePluginLoading.push((failed) => {
            if (!failed && window.LmsTogglePlugin) {
              window.LmsTogglePlugin.applyToggleOverlay(embed, textarea, height, rows, origin, widgetBg, autoload, embed._starterCode);
            } else {
              applyDefaultSwap(embed, textarea, height, rows, origin, widgetBg, embed._starterCode);
            }
          });
        } else {
          window.LmsTogglePlugin.applyToggleOverlay(embed, textarea, height, rows, origin, widgetBg, autoload, embed._starterCode);
        }
      } else {
        applyDefaultSwap(embed, textarea, height, rows, origin, widgetBg, embed._starterCode);
      }
    }

    if (!window.__pythonIdeHeightListenerAttached) {
      window.__pythonIdeHeightListenerAttached = true;
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'SYNC_HEIGHT') {
          const newHeight = e.data.payload?.height || e.data.height;
          if (newHeight && typeof newHeight === 'number' && newHeight >= 100) {
            const iframes = document.querySelectorAll('iframe[data-lms-widget]');
            iframes.forEach(iframe => {
              if (iframe.contentWindow === e.source) {
                if (iframe.__isManuallyResized) return;

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

    // Notify that initial embeds are processed
    document.dispatchEvent(new CustomEvent('lms-widgets:init', {
      bubbles: true
    }));

    // Ensure the external LMSWidgetManager module is loaded
    loadLMSWidgetManager();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEmbeds);
  } else {
    initEmbeds();
  }
})();
