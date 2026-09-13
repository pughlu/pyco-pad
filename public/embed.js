(function() {
  function initEmbeds() {
    // Find all placeholder divs that haven't been initialized yet
    const embeds = document.querySelectorAll('.python-ide-embed:not([data-initialized])');
    
    // Get the base URL of where this embed.js script is hosted (e.g., https://python-web-ide.pwlewis.workers.dev)
    // This ensures the iframe and decorator load from the correct domain dynamically.
    const currentScript = document.currentScript;
    let origin = 'https://python-web-ide.pwlewis.workers.dev'; // fallback
    if (currentScript && currentScript.src) {
      origin = new URL(currentScript.src).origin;
    }
    
    embeds.forEach(embed => {
      // Mark as initialized so we don't process it twice
      embed.setAttribute('data-initialized', 'true');
      
      // Determine height: First check data-height, then try to match Moodle textarea, finally fallback to 400
      let height = embed.getAttribute('data-height');
      if (!height) {
        // Find the parent Moodle question container (usually .que or .formulation)
        const questionContainer = embed.closest('.que, .formulation, form') || document;
        const textarea = questionContainer.querySelector('textarea');
        if (textarea && textarea.clientHeight > 100) {
          height = textarea.clientHeight;
        } else {
          height = 400;
        }
      }
      
      // Build the standard lms-widget-container
      const container = document.createElement('div');
      container.className = 'lms-widget-container';
      
      // Build the iframe pointing to the IDE with sync enabled
      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-lms-widget', 'true');
      iframe.setAttribute('width', '100%');
      iframe.setAttribute('height', height);
      iframe.src = `${origin}/?sync=true`;
      
      container.appendChild(iframe);
      embed.appendChild(container);
    });

    // 1. Inject the LMS Widget Manager if it isn't already on the page
    if (!window.LMSWidgetManager && !document.querySelector('script[src*="lms-widget-manager"]')) {
       const managerScript = document.createElement('script');
       managerScript.type = 'module';
       // Using the generic pages.dev domain you had for the manager, 
       // but you can change this to ${origin}/lms-widget-manager.es.js if you host them together.
       managerScript.src = 'https://python-web-ide.pages.dev/lms-widget-manager.es.js';
       document.head.appendChild(managerScript);
    }
    
    // 2. Inject the Moodle Pre-Decorator if it isn't already on the page
    if (!document.querySelector('script[src*="moodle-pre-decorator.js"]')) {
       const decoratorScript = document.createElement('script');
       decoratorScript.src = `${origin}/moodle-pre-decorator.js`;
       document.head.appendChild(decoratorScript);
    }
  }

  // Run the initialization as soon as the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEmbeds);
  } else {
    initEmbeds();
  }
})();
