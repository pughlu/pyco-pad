(function() {
  document.addEventListener('DOMContentLoaded', () => {
    // Find all <pre> tags (you can narrow this to .qtext pre if needed)
    const preTags = document.querySelectorAll('pre');
    
    preTags.forEach(pre => {
      // Create a button wrapper
      const btn = document.createElement('div');
      btn.textContent = 'Copy to Editor';
      btn.style.cssText = 'float: right; margin-top: -30px; margin-right: 10px; position: relative; z-index: 10; user-select: none; cursor: pointer; background: #0e639c; color: white; padding: 4px 12px; border-radius: 4px; font-family: sans-serif; font-size: 12px; font-weight: bold;';
      
      btn.addEventListener('click', () => {
        const text = pre.innerText + '\n';
        
        // Strategy 1: Use lms-widget-manager if it exists and is active
        if (window.LMSWidgetManager && window.LMSWidgetManager.activeControllers && window.LMSWidgetManager.activeControllers.length > 0) {
          window.LMSWidgetManager.activeControllers[0].insertContent(text);
        } else {
          // Strategy 2: Fallback to directly posting to the iframe if manager is not exposing it
          const iframes = document.querySelectorAll('iframe');
          if (iframes.length > 0) {
            iframes[0].contentWindow.postMessage({
              type: 'INSERT_CONTENT',
              payload: { content: text }
            }, '*');
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
      
      // Insert button right after the <pre>
      pre.parentNode.insertBefore(btn, pre.nextSibling);
      
      // Add a clear-both div below the button
      const clear = document.createElement('div');
      clear.style.clear = 'both';
      pre.parentNode.insertBefore(clear, btn.nextSibling);
    });
  });
})();
