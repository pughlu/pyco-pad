(function () {
  document.addEventListener('DOMContentLoaded', () => {
    // Find all <pre> tags (you can narrow this to .qtext pre if needed)
    const preTags = document.querySelectorAll('pre');

    preTags.forEach(pre => {
      // Create a wrapper to safely absolute-position the button over the pre (even if it scrolls)
      const wrapper = document.createElement('div');
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
      // bottom: 0.5em nicely centers it vertically if it's a 1-liner with standard padding, 
      // and pins it to the bottom-right corner for multi-liners. Using em units ensures it scales with Moodle's text zoom.
      btn.style.cssText = 'position: absolute; right: 0.5em; bottom: 0.5em; z-index: 10; user-select: none; cursor: pointer; background: #0e639c; color: white; padding: 0.4em 1em; border-radius: 0.3em; font-family: sans-serif; font-size: 0.85em; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.15); transition: background 0.2s;';

      btn.addEventListener('click', () => {
        const text = pre.innerText + '\n';

        // Strategy 1: Dispatch decoupled event for LMSWidgetManager
        console.log('[Moodle Decorator] Dispatching lms-widget:insert-content event');
        document.dispatchEvent(new CustomEvent('lms-widget:insert-content', {
          detail: { content: text }
        }));
        /*
        // Strategy 2: Fallback to directly posting to the iframe if manager is not present
        if (!window.LMSWidgetManager) {
          const iframes = document.querySelectorAll('iframe');
          if (iframes.length > 0) {
            console.log('[Moodle Decorator] LMSWidgetManager not found. Falling back to direct iframe postMessage');
            iframes[0].contentWindow.postMessage({
              type: 'INSERT_CONTENT',
              payload: { content: text }
            }, '*');
          } else {
            console.warn('[Moodle Decorator] Failed to copy: No target iframe found.');
          }
        }
        */
        // Visual feedback
        const oldText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = '#4ec9b0';
        setTimeout(() => {
          btn.textContent = oldText;
          btn.style.background = '#0e639c';
        }, 1500);
        */
      });

      // Insert button inside the wrapper, overlapping the <pre>
      wrapper.appendChild(btn);
    });
  });
})();
