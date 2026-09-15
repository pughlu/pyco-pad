(function () {
  const currentScript = document.currentScript;
  let defaultOrigin = 'https://pyco-pad.pages.dev';
  if (currentScript && currentScript.src) {
    try {
      defaultOrigin = new URL(currentScript.src).origin;
    } catch (e) { }
  }

  function initEmbeds() {
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

    for (const embed of embeds) {
      const height = embed.getAttribute('data-height') || 400;
      
      let savedTheme = 'dark';
      try {
        savedTheme = localStorage.getItem('py_ide_theme') || 'dark';
      } catch (e) { }
      const widgetBg = savedTheme === 'light' ? '#ffffff' : '#1e1e1e';

      const iframe = document.createElement('iframe');
      iframe.setAttribute('width', '100%');
      iframe.setAttribute('height', height);
      iframe.style.width = '100%';
      iframe.style.border = 'none';
      iframe.style.outline = 'none';
      iframe.style.borderRadius = '8px';
      iframe.style.overflow = 'hidden';
      iframe.style.background = widgetBg;
      
      // Load standard mode (no sync=true required)
      iframe.src = `${origin}/`;

      embed.appendChild(iframe);

      if (embed._starterCode) {
        // Send the starter code once the iframe signals it's ready, or blindly after a delay
        // The IDE sends SYNC_HEIGHT when it mounts, we can listen for that.
        const onMessage = (e) => {
          if (e.source === iframe.contentWindow && e.data && e.data.type === 'SYNC_HEIGHT') {
            if (!iframe._hasLoadedCode) {
              iframe._hasLoadedCode = true;
              iframe.contentWindow.postMessage({ 
                type: 'LOAD_CONTENT', 
                payload: { content: embed._starterCode } 
              }, '*');
            }
          }
        };
        window.addEventListener('message', onMessage);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEmbeds);
  } else {
    initEmbeds();
  }
})();
