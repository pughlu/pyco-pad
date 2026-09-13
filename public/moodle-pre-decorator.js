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
  });
})();
