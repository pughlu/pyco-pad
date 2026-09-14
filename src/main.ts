import './style.css';
import { Editor } from './editor';
import { SkulptRunner } from './skulpt-runner';
import type { HostMessage } from './types';

declare var LZString: any;

const editor = new Editor();

const loadCodeFromHash = () => {
  const hash = window.location.hash;
  if (hash.startsWith('#c=')) {
    try {
      if (typeof LZString !== 'undefined') {
        const compressed = hash.substring(3);
        const code = LZString.decompressFromEncodedURIComponent(compressed);
        if (code) {
          editor.setValue(code);
        }
      }
    } catch (e) {
      console.error("Failed to decompress code from URL", e);
    }
  }
};

loadCodeFromHash();
window.addEventListener('hashchange', loadCodeFromHash);
const runner = new SkulptRunner();

const syncStatus = document.getElementById('sync-status') as HTMLElement;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isLocked = false;

// --- URL PARAMETERS ---
const urlParams = new URLSearchParams(window.location.search);
const isSyncEnabled = urlParams.get('sync') === 'true';
const isSafeModeVisible = urlParams.get('safeMode') === 'true';
const targetRows = parseInt(urlParams.get('rows') || '0', 10);

if (isSyncEnabled) {
    syncStatus.style.display = 'inline-block';
} else {
    syncStatus.style.display = 'none';
}

if (isSafeModeVisible) {
    document.getElementById('safe-mode-container')!.style.display = 'flex';
} else {
    document.getElementById('safe-mode-container')!.style.display = 'none';
}

// UI Setup
document.getElementById('btn-run')?.addEventListener('click', () => {
    runner.runCode(editor.getValue());
});

const btnShare = document.getElementById('btn-share');
if (isSyncEnabled && btnShare) {
    btnShare.style.display = 'none';
}
btnShare?.addEventListener('click', () => {
    if (isSyncEnabled) return; // double safety
    if (typeof LZString === 'undefined') return;
    const code = editor.getValue();
    const compressed = LZString.compressToEncodedURIComponent(code);
    const url = new URL(window.location.href);
    url.hash = 'c=' + compressed;
    
    navigator.clipboard.writeText(url.href).then(() => {
        const originalContent = btnShare.innerHTML;
        btnShare.innerHTML = '<span style="color:#4ec9b0;font-weight:bold;">Copied!</span>';
        setTimeout(() => {
            btnShare.innerHTML = originalContent;
        }, 2000);
    });
});

// 1. Listen for messages from Host LMS Manager
if (isSyncEnabled) {
    window.addEventListener('message', (event: MessageEvent) => {
        let msg: HostMessage;
        if (typeof event.data === 'string') {
            try { 
                msg = JSON.parse(event.data); 
            } catch { 
                return; 
            }
        } else {
            msg = event.data;
        }

        if (!msg || typeof msg !== 'object') return;

        switch (msg.type) {
            case 'LOAD_CONTENT': {
                const { content, config } = msg.payload || {};
                if (content !== undefined) editor.setValue(content);
                if (config) {
                    if (config.isReadOnly || config.runMode === 'review' || config.runMode === 'grade') {
                        editor.setReadOnly(true);
                        syncStatus.textContent = (window as any).IDE_UI_STRINGS?.statusReadOnly || 'Read-Only';
                    } else {
                        editor.setReadOnly(false);
                        syncStatus.textContent = (window as any).IDE_UI_STRINGS?.statusReady || 'Ready';
                    }
                } else {
                    syncStatus.textContent = (window as any).IDE_UI_STRINGS?.statusReady || 'Ready';
                }
                break;
            }

            case 'SYNC_ACK': {
                if (!isLocked && !editor.isReadOnly) {
                    syncStatus.textContent = (window as any).IDE_UI_STRINGS?.statusSaved || 'Saved to LMS';
                }
                break;
            }

            case 'INSERT_CONTENT': {
                if (isLocked || editor.isReadOnly) return;
                
                // Only insert if the user is actively focused on an editor
                const activeEl = document.activeElement;
                if (activeEl instanceof HTMLElement && (activeEl.isContentEditable || ['TEXTAREA', 'INPUT'].includes(activeEl.tagName))) {
                    const { content } = msg.payload || {};
                    if (typeof content === 'string') {
                        editor.insertContent(content);
                    }
                }
                break;
            }

            case 'ERROR_LOCKDOWN': {
                isLocked = true;
                editor.setReadOnly(true);
                syncStatus.textContent = (window as any).IDE_UI_STRINGS?.statusFailed || 'Save Failed / Locked';
                syncStatus.style.color = 'var(--output-error)';
                break;
            }
        }
    });

    // 2. Debounced sync to host
    function triggerSync() {
        if (isLocked || editor.isReadOnly || !isSyncEnabled) return;
        syncStatus.textContent = (window as any).IDE_UI_STRINGS?.statusSyncing || 'Syncing...';
        if (debounceTimer) clearTimeout(debounceTimer);
        
        debounceTimer = setTimeout(() => {
            const msgId = 'msg-' + Math.random().toString(36).substr(2, 9);
            window.parent.postMessage({
                type: 'SYNC_CONTENT',
                msgId,
                payload: { content: editor.getValue(), msgId }
            }, '*');
        }, 200);
    }

    document.getElementById('editing')?.addEventListener('input', triggerSync);

    // 4. Request content once ready
    window.parent.postMessage({ type: 'REQUEST_CONTENT' }, '*');
}

// --- SETTINGS UI & PERSISTENCE ---
const btnConfig = document.getElementById('btn-config') as HTMLButtonElement;
const settingsModal = document.getElementById('settings-modal') as HTMLElement;
const btnCloseSettings = document.getElementById('btn-close-settings') as HTMLButtonElement;
const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
const btnFontInc = document.getElementById('btn-font-inc') as HTMLButtonElement;
const btnFontDec = document.getElementById('btn-font-dec') as HTMLButtonElement;
const fontSizeDisplay = document.getElementById('font-size-display') as HTMLElement;

// 1. Theme Persistence
function applyTheme(theme: string) {
    document.body.className = '';
    if (theme === 'light') {
        document.body.classList.add('theme-light');
    } else if (theme === 'hc') {
        document.body.classList.add('theme-hc');
    }
    themeSelect.value = theme;
}

let savedTheme = 'dark';
try {
    savedTheme = localStorage.getItem('py_ide_theme') || 'dark';
} catch (e) {
    console.warn('Cannot read theme from localStorage:', e);
}
applyTheme(savedTheme);

themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
    try {
        localStorage.setItem('py_ide_theme', themeSelect.value);
    } catch (e) {
        console.warn('Cannot save theme to localStorage:', e);
    }
});

// 2. Font Size Persistence & Height Scaling
let currentFontSize = 1.0;
try {
    const savedFontSize = parseFloat(localStorage.getItem('py_ide_font_size_em') || '1.0');
    if (!isNaN(savedFontSize) && savedFontSize >= 0.5 && savedFontSize <= 3.0) {
        currentFontSize = savedFontSize;
    }
} catch (e) {
    console.warn('Cannot read font size from localStorage:', e);
}

function notifyHeightBasedOnRows() {
    // 40px toolbar + 35px panel header + 30px editor padding + 10px buffer = 115px
    const pixelFontSize = currentFontSize * 16;
    const lineHeight = pixelFontSize * 1.5;
    const chromeHeight = 115;
    let neededHeight: number;
    if (targetRows > 0) {
        neededHeight = Math.round(chromeHeight + (targetRows * lineHeight));
    } else {
        const containerEl = document.getElementById('main-container');
        neededHeight = Math.max(350, containerEl ? containerEl.scrollHeight + 40 : 380);
    }
    window.parent.postMessage({
        type: 'SYNC_HEIGHT',
        payload: { height: neededHeight }
    }, '*');
}

btnConfig.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
});

btnCloseSettings.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});

function updateFontSize() {
    fontSizeDisplay.textContent = currentFontSize.toFixed(1) + 'em';
    document.documentElement.style.setProperty('--editor-font-size', currentFontSize + 'em');
    try {
        localStorage.setItem('py_ide_font_size_em', currentFontSize.toString());
    } catch (e) {
        console.warn('Cannot save font size to localStorage:', e);
    }
    notifyHeightBasedOnRows();
}

btnFontInc.addEventListener('click', () => {
    if (currentFontSize < 3.0) {
        currentFontSize += 0.1;
        updateFontSize();
    }
});

btnFontDec.addEventListener('click', () => {
    if (currentFontSize > 0.5) {
        currentFontSize -= 0.1;
        updateFontSize();
    }
});

updateFontSize();
// Notify initial height if rows parameter is set
notifyHeightBasedOnRows();
