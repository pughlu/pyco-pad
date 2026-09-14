(function() {
  window.LmsTogglePlugin = {
    applyToggleOverlay: function(embed, textarea, height, rows, origin, widgetBg, autoload) {
      if (!textarea) return false;

      // Save dimensions
      const originalTextareaHeight = textarea.clientHeight || (rows > 0 ? rows * 22 : 160);
      const computedStyle = window.getComputedStyle(textarea);
      
      // Calculate initial expected iframe height including header allowance (115px)
      const headerAllowance = 115;
      let iframeHeight = height ? parseInt(height, 10) : (originalTextareaHeight + headerAllowance);
      if (iframeHeight < 300) iframeHeight = 350;

      // We will place a placeholder in the DOM to reserve space
      const placeholder = document.createElement('div');
      placeholder.className = 'lms-toggle-placeholder';
      placeholder.style.width = '100%';
      placeholder.style.height = originalTextareaHeight + 'px';
      placeholder.style.position = 'relative';
      placeholder.style.transition = 'none';
      if (computedStyle && computedStyle.margin && computedStyle.margin !== '0px') {
        placeholder.style.margin = computedStyle.margin;
      }
      
      // Force enough top margin to fit the toggle button above the widget
      const currentTopMargin = parseInt(placeholder.style.marginTop || '0', 10);
      if (currentTopMargin < 30) {
        placeholder.style.marginTop = '30px';
      }
      
      // Toggle State Management
      let savedMode = null;
      try {
        savedMode = localStorage.getItem('py_ide_view_mode');
      } catch (e) {}
      let targetMode = savedMode || (autoload ? 'iframe' : 'textarea');
      let viewMode = 'loading';
      let isIframeReady = false;

      // If we target the iframe, obscure everything immediately with the widget background
      if (targetMode === 'iframe') {
        placeholder.style.background = widgetBg;
      }
      
      // Toggle button
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.textContent = targetMode === 'iframe' ? window.PYTHON_IDE_STRINGS.switchToTextEditorBtn : window.PYTHON_IDE_STRINGS.switchToIdeBtn;
      toggleBtn.disabled = true;
      toggleBtn.style.cssText = 'position: absolute; right: 0; top: -28px; padding: 4px 10px; font-size: 11px; font-weight: 500; cursor: pointer; border-radius: 4px; border: 1px solid #ccc; background: #f9f9f9; color: #333; z-index: 20; transition: background 0.2s, opacity 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: block;';
      placeholder.appendChild(toggleBtn);
      
      // Resize Handle (Lower RHS, textarea style)
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'lms-widget-resize-handle';
      resizeHandle.title = window.PYTHON_IDE_STRINGS.dragToResizeTitle || 'Drag to resize editor';
      resizeHandle.style.cssText = 'position: absolute; right: 2px; bottom: 2px; width: 16px; height: 16px; cursor: se-resize; z-index: 25; display: none; opacity: 0.5; transition: opacity 0.2s; user-select: none; touch-action: none;';
      resizeHandle.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block; pointer-events: none;">
          <path d="M12 4L4 12M12 8L8 12M12 12L12 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      `;
      resizeHandle.style.color = widgetBg === '#ffffff' ? '#666' : '#bbb';
      resizeHandle.addEventListener('mouseenter', () => { resizeHandle.style.opacity = '1'; });
      resizeHandle.addEventListener('mouseleave', () => { resizeHandle.style.opacity = '0.5'; });
      placeholder.appendChild(resizeHandle);

      let isDragging = false;
      let startY = 0;
      let startHeight = 0;

      resizeHandle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        iframe.__isManuallyResized = true;
        startY = e.clientY;
        startHeight = placeholder.offsetHeight;
        try {
          resizeHandle.setPointerCapture(e.pointerId);
        } catch (err) {}
        
        iframe.style.pointerEvents = 'none';
        document.body.style.userSelect = 'none';

        const onPointerMove = (moveEvt) => {
          if (!isDragging) return;
          const deltaY = moveEvt.clientY - startY;
          const newHeight = Math.max(180, Math.round(startHeight + deltaY));
          placeholder.style.height = newHeight + 'px';
          container.style.height = newHeight + 'px';
          iframe.style.height = newHeight + 'px';
          iframeHeight = newHeight;
          iframe.setAttribute('height', newHeight);
        };

        const onPointerUp = () => {
          if (!isDragging) return;
          isDragging = false;
          try {
            resizeHandle.releasePointerCapture(e.pointerId);
          } catch (err) {}
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          
          iframe.style.pointerEvents = 'auto';
          document.body.style.removeProperty('user-select');
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      });
      
      // The iframe container
      const container = document.createElement('div');
      container.className = 'lms-widget-container';
      // Signal to LMSWidgetManager that we handle answerbox visibility (do NOT hide to -9999px)
      container.setAttribute('data-lms-widget-show-answerbox', 'true');
      // Set origin to '*' so LMSWidgetManager can communicate regardless of domain differences
      container.setAttribute('data-widget-origin', '*');
      container.setAttribute('data-origin', '*');
      if (textarea.id) {
        container.setAttribute('data-lms-target-textarea', '#' + textarea.id);
      }
      if (textarea.name) {
        container.setAttribute('data-lms-textarea-name', textarea.name);
      }
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.transition = 'opacity 0.2s ease-out';
      
      // Insert placeholder before textarea
      textarea.parentNode.insertBefore(placeholder, textarea);
      
      // Position textarea over the placeholder
      textarea.style.position = 'absolute';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '100%';
      textarea.style.height = '100%';
      textarea.style.boxSizing = 'border-box';
      textarea.style.margin = '0';
      textarea.style.transition = 'opacity 0.2s ease-out';
      
      // Move textarea and container INTO the placeholder
      placeholder.appendChild(textarea);
      placeholder.appendChild(container);

      // Prepare Iframe
      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-lms-widget', 'true');
      iframe.setAttribute('width', '100%');
      iframe.setAttribute('height', iframeHeight);
      iframe.style.width = '100%';
      iframe.style.border = 'none';
      iframe.style.outline = 'none';
      iframe.style.borderRadius = '4px';
      iframe.style.background = widgetBg;
      iframe.style.position = 'absolute';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.transition = 'opacity 0.2s ease-out';
      
      const rowsParam = rows > 0 ? `&rows=${rows}` : '';
      iframe.src = `${origin}/?sync=true${rowsParam}`;
      container.appendChild(iframe);

      // Notify LMSWidgetManager that a new container is mounted (decoupled handshake)
      container.dispatchEvent(new CustomEvent('lms-widget:mount', {
        bubbles: true,
        detail: { container: container }
      }));

      // Ensure the external LMSWidgetManager module is loaded
      if (typeof window.loadLMSWidgetManager === 'function') {
        window.loadLMSWidgetManager();
      } else if (!window.LMSWidgetManager) {
        const mgrUrl = window.LMS_WIDGET_MANAGER_URL || new URL('lms-widget-manager.iife.js', origin).href;
        const existing = document.querySelector('script[data-lms-manager]');
        if (!existing) {
          const script = document.createElement('script');
          script.setAttribute('data-lms-manager', 'true');
          script.src = mgrUrl;
          script.onload = () => { if (typeof window.LMSWidgetManager !== 'undefined') { /* loaded */ } };
          script.onerror = (err) => console.error('[LmsTogglePlugin] Error loading LMSWidgetManager:', err);
          document.head.appendChild(script);
        }
      }

      function updateView(animate = true) {
        if (!animate) {
          textarea.style.transition = 'none';
          iframe.style.transition = 'none';
        } else {
          textarea.style.transition = 'opacity 0.2s ease-out';
          iframe.style.transition = 'opacity 0.2s ease-out';
        }
        placeholder.style.transition = 'none';

        if (!animate) void placeholder.offsetHeight; // reflow

        toggleBtn.style.display = 'block';
        toggleBtn.disabled = !isIframeReady;

        if (viewMode === 'iframe') {
          toggleBtn.textContent = window.PYTHON_IDE_STRINGS.switchToTextEditorBtn;
          resizeHandle.style.display = 'block';
          
          // Hide textarea
          textarea.style.setProperty('opacity', '0', 'important');
          textarea.style.setProperty('pointer-events', 'none', 'important');
          textarea.style.setProperty('z-index', '1', 'important');
          
          // Show iframe
          iframe.style.setProperty('opacity', '1', 'important');
          iframe.style.setProperty('pointer-events', 'auto', 'important');
          iframe.style.setProperty('z-index', '2', 'important');
          
          // Expand placeholder to accurate iframe height instantly
          placeholder.style.height = iframeHeight + 'px';
          container.style.height = iframeHeight + 'px';
          iframe.style.height = iframeHeight + 'px';
          placeholder.style.background = 'transparent';
        } else {
          toggleBtn.textContent = window.PYTHON_IDE_STRINGS.switchToIdeBtn;
          resizeHandle.style.display = 'none';
          
          // Hide iframe
          iframe.style.setProperty('opacity', '0', 'important');
          iframe.style.setProperty('pointer-events', 'none', 'important');
          iframe.style.setProperty('z-index', '1', 'important');
          
          // CANCEL left: -9999px and restore textarea fully visible and editable
          textarea.style.setProperty('left', '0', 'important');
          textarea.style.setProperty('top', '0', 'important');
          textarea.style.setProperty('position', 'absolute', 'important');
          textarea.style.setProperty('width', '100%', 'important');
          textarea.style.setProperty('height', '100%', 'important');
          textarea.style.setProperty('opacity', '1', 'important');
          textarea.style.setProperty('visibility', 'visible', 'important');
          textarea.style.setProperty('pointer-events', 'auto', 'important');
          textarea.style.setProperty('z-index', '2', 'important');
          
          // Unhide Moodle parent answer block if needed
          const answerBlock = textarea.closest('.answer');
          if (answerBlock) {
            answerBlock.style.removeProperty('display');
          }
          
          // Shrink placeholder to original textarea height
          placeholder.style.height = originalTextareaHeight + 'px';
          placeholder.style.background = 'transparent';
        }
      }

      // Initial visual setup while iframe loads in background
      if (targetMode === 'textarea') {
        textarea.style.setProperty('left', '0', 'important');
        textarea.style.setProperty('opacity', '1', 'important');
        textarea.style.setProperty('pointer-events', 'auto', 'important');
        textarea.style.setProperty('z-index', '2', 'important');
      } else {
        textarea.style.setProperty('opacity', '0', 'important');
        textarea.style.setProperty('pointer-events', 'none', 'important');
        textarea.style.setProperty('z-index', '1', 'important');
      }

      function markReadyAndApply(animate = true) {
        if (isIframeReady) return;
        isIframeReady = true;
        toggleBtn.disabled = false;
        viewMode = targetMode;
        updateView(animate);
      }

      function handleNewIframeHeight(newHeight) {
        if (iframe.__isManuallyResized) return;
        if (typeof newHeight === 'number' && newHeight >= 100) {
          iframeHeight = newHeight;
          if (isIframeReady && viewMode === 'iframe') {
            placeholder.style.height = iframeHeight + 'px';
            container.style.height = iframeHeight + 'px';
            iframe.style.height = iframeHeight + 'px';
          } else if (!isIframeReady && targetMode === 'iframe') {
            // First accurate height received from rendered iframe, perform transition now!
            markReadyAndApply(true);
          }
        }
      }

      // Listen for messages directly from the iframe
      const onMessage = (e) => {
        if (e.source === iframe.contentWindow && e.data) {
          if (e.data.type === 'SYNC_HEIGHT') {
            const h = e.data.payload?.height || e.data.height;
            if (h) handleNewIframeHeight(h);
          }
        }
      };
      window.addEventListener('message', onMessage);

      iframe.__updateToggleHeight = handleNewIframeHeight;

      iframe.addEventListener('load', () => {
        iframe.setAttribute('data-lms-toggle-instance', 'true');
        // If textarea has initial content, ensure IDE gets it
        if (textarea.value && textarea.value.trim().length > 0) {
          try {
            iframe.contentWindow.postMessage({
              type: 'LOAD_CONTENT',
              payload: { content: textarea.value }
            }, '*');
          } catch (err) {}
        }
        // Give short delay for SYNC_HEIGHT message if coming right on load, then reveal
        setTimeout(() => {
          markReadyAndApply(true);
        }, 60);
      });

      // Fallback timeout in case iframe fails or takes long
      setTimeout(() => {
        if (!isIframeReady) {
          markReadyAndApply(false);
        }
      }, 3500);

      toggleBtn.addEventListener('click', () => {
        if (!isIframeReady) return;
        viewMode = viewMode === 'iframe' ? 'textarea' : 'iframe';
        targetMode = viewMode;
        try {
          localStorage.setItem('py_ide_view_mode', viewMode);
        } catch (e) {}

        // If switching back into IDE, sync latest textarea changes to IDE
        if (viewMode === 'iframe' && iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              type: 'LOAD_CONTENT',
              payload: { content: textarea.value }
            }, '*');
          } catch (err) {}
        }

        updateView(true);
      });

      return true;
    }
  };
})();
