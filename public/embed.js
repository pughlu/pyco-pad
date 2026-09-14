(function() {
  console.warn('[PycoPad] You are loading embed.js, which is deprecated. It is automatically loading pycopad-mdl-quiz.js for backwards compatibility. Please update your embed codes to point to pycopad-mdl-quiz.js directly.');
  
  const currentScript = document.currentScript;
  let origin = 'https://pyco-pad.pages.dev';
  if (currentScript && currentScript.src) {
    try {
      origin = new URL(currentScript.src).origin;
    } catch (e) { }
  }

  const script = document.createElement('script');
  script.src = `${origin}/pycopad-mdl-quiz.js`;
  
  // Copy all data attributes so pycopad-mdl-quiz.js inherits them
  if (currentScript) {
    Array.from(currentScript.attributes).forEach(attr => {
      if (attr.name.startsWith('data-')) {
        script.setAttribute(attr.name, attr.value);
      }
    });
  }

  document.head.appendChild(script);
})();
