'use strict';
// Real links remain usable if scripting or embedded documents are unavailable.
(() => {
  const layer = document.createElement('dialog');
  layer.id = 'legal-dialog';
  layer.setAttribute('aria-labelledby', 'legal-dialog-title');
  layer.innerHTML = '<header class="legal-toolbar"><h2 id="legal-dialog-title">Legal information</h2><a id="legal-direct" target="_blank" rel="noopener">Open full page</a><button type="button" class="close" aria-label="Close legal information" autofocus>&times;</button></header><iframe title="Legal information"></iframe>';
  document.body.append(layer);
  const frame = layer.querySelector('iframe');
  const title = layer.querySelector('h2');
  const direct = layer.querySelector('a');
  let opener;
  document.querySelectorAll('[data-legal-page]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || typeof layer.showModal !== 'function') return;
      event.preventDefault();
      opener = link;
      const name = link.getAttribute('href') === 'privacy.html' ? 'Privacy policy' : 'Legal notice / Imprint';
      title.textContent = name;
      frame.title = name;
      frame.src = link.href + '#legal-embed';
      direct.href = link.href;
      layer.showModal();
    });
  });
  layer.querySelector('button').addEventListener('click', () => layer.close());
  layer.addEventListener('close', () => {
    frame.removeAttribute('src');
    opener?.focus({ preventScroll: true });
  });
  // Native dialog handles Escape and keeps keyboard focus within the overlay.
  document.getElementById('settings').addEventListener('click', () => {
    const settings = document.getElementById('settings-dialog');
    if (!settings.open) settings.showModal();
  });
  document.getElementById('close-settings').addEventListener('click', () => {
    document.getElementById('settings-dialog').close();
  });
})();
