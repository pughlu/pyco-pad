(function() {
  window.LmsTogglePlugin = {
    applyToggleOverlay: function(embed, textarea, height, rows, origin, widgetBg, autoload) {
      if (!textarea) return false;

      // Save dimensions
      const originalTextareaHeight = textarea.clientHeight;
      
      // We will place a placeholder in the DOM to reserve space
      const placeholder = document.createElement('div');
      placeholder.className = 'lms-toggle-placeholder';
      placeholder.style.width = '100%';
      placeholder.style.height = originalTextareaHeight + 'px';
      placeholder.style.position = 'relative';
      placeholder.style.transition = 'height 0.2s ease-out';
      
      // If autoload is on, obscure everything immediately
      if (autoload) {
        placeholder.style.background = widgetBg;
      }
      
      // Toggle button
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.textContent = 'Switch to Raw Text';
      toggleBtn.style.cssText = 'position: absolute; right: 0; top: -30px; padding: 4px 10px; font-size: 12px; cursor: pointer; border-radius: 4px; border: 1px solid #ccc; background: #f9f9f9; color: #333; z-index: 10; transition: background 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: none;';
      placeholder.appendChild(toggleBtn);
      
      // The iframe container
      const container = document.createElement('div');
      container.className = 'lms-widget-container';
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
      let viewMode = autoload ? 'iframe' : 'textarea';
      try {
        const saved = localStorage.getItem('py_ide_view_mode');
        if (saved) viewMode = saved;
      } catch (e) {}

      let iframeHeight = height || 400; // Track the height the iframe WANTS to be

      function updateView(animate = true) {
        if (!animate) {
          textarea.style.transition = 'none';
          iframe.style.transition = 'none';
          placeholder.style.transition = 'none';
        } else {
          textarea.style.transition = 'opacity 0.2s ease-out';
          iframe.style.transition = 'opacity 0.2s ease-out';
          placeholder.style.transition = 'height 0.2s ease-out';
        }

        if (!animate) void placeholder.offsetHeight; // reflow

        toggleBtn.style.display = 'block';

        if (viewMode === 'iframe') {
          toggleBtn.textContent = 'Switch to Raw Text';
          textarea.style.opacity = '0';
          textarea.style.pointerEvents = 'none';
          textarea.style.zIndex = '1';
          
          iframe.style.opacity = '1';
          iframe.style.pointerEvents = 'auto';
          iframe.style.zIndex = '2';
          
          placeholder.style.height = iframeHeight + 'px';
          placeholder.style.background = 'transparent'; // Reveal iframe
        } else {
          toggleBtn.textContent = 'Switch to IDE';
          iframe.style.opacity = '0';
          iframe.style.pointerEvents = 'none';
          iframe.style.zIndex = '1';
          
          textarea.style.opacity = '1';
          textarea.style.pointerEvents = 'auto';
          textarea.style.zIndex = '2';
          
          placeholder.style.height = originalTextareaHeight + 'px';
          placeholder.style.background = 'transparent'; // Reveal textarea
        }
      }

      // Initial state
      iframe.style.opacity = '0';
      if (autoload) {
        textarea.style.opacity = '0'; // Hide behind solid background
      } else {
        textarea.style.opacity = '1'; 
      }

      iframe.addEventListener('load', () => {
        updateView(true);
      });

      toggleBtn.addEventListener('click', () => {
        viewMode = viewMode === 'iframe' ? 'textarea' : 'iframe';
        try {
          localStorage.setItem('py_ide_view_mode', viewMode);
        } catch (e) {}
        updateView(true);
      });

      iframe.addEventListener('load', () => {
          iframe.setAttribute('data-lms-toggle-instance', 'true');
      });

      iframe.__updateToggleHeight = (newHeight) => {
          iframeHeight = newHeight;
          if (viewMode === 'iframe') {
              placeholder.style.height = iframeHeight + 'px';
          }
      };

      return true;
    }
  };
})();
