import './style.css';
import { Editor } from './editor';
import { SkulptRunner } from './skulpt-runner';
import type { HostMessage } from './types';

const editor = new Editor();
const runner = new SkulptRunner();

const syncStatus = document.getElementById('sync-status') as HTMLElement;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isLocked = false;

// --- URL PARAMETERS ---
const urlParams = new URLSearchParams(window.location.search);
const isSyncEnabled = urlParams.get('sync') === 'true';
const isSafeModeVisible = urlParams.get('safeMode') === 'true';

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
                        syncStatus.textContent = 'Read-Only';
                    } else {
                        editor.setReadOnly(false);
                        syncStatus.textContent = 'Ready';
                    }
                } else {
                    syncStatus.textContent = 'Ready';
                }
                break;
            }

            case 'SYNC_ACK': {
                if (!isLocked && !editor.isReadOnly) {
                    syncStatus.textContent = 'Saved to LMS';
                }
                break;
            }

            case 'INSERT_CONTENT': {
                if (isLocked || editor.isReadOnly) return;
                const { content } = msg.payload || {};
                if (typeof content === 'string') {
                    editor.insertContent(content);
                }
                break;
            }

            case 'ERROR_LOCKDOWN': {
                isLocked = true;
                editor.setReadOnly(true);
                syncStatus.textContent = 'Save Failed / Locked';
                syncStatus.style.color = 'var(--output-error)';
                break;
            }
        }
    });

    // 2. Debounced sync to host
    function triggerSync() {
        if (isLocked || editor.isReadOnly || !isSyncEnabled) return;
        syncStatus.textContent = 'Syncing...';
        if (debounceTimer) clearTimeout(debounceTimer);
        
        debounceTimer = setTimeout(() => {
            const msgId = 'msg-' + Math.random().toString(36).substr(2, 9);
            window.parent.postMessage({
                type: 'SYNC_CONTENT',
                payload: { content: editor.getValue(), msgId }
            }, '*');
        }, 200);
    }

    document.getElementById('editing')?.addEventListener('input', triggerSync);

    // 4. Request content once ready
    window.parent.postMessage({ type: 'REQUEST_CONTENT' }, '*');
}

// --- SETTINGS UI ---
const btnConfig = document.getElementById('btn-config') as HTMLButtonElement;
const settingsModal = document.getElementById('settings-modal') as HTMLElement;
const btnCloseSettings = document.getElementById('btn-close-settings') as HTMLButtonElement;
const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
const btnFontInc = document.getElementById('btn-font-inc') as HTMLButtonElement;
const btnFontDec = document.getElementById('btn-font-dec') as HTMLButtonElement;
const fontSizeDisplay = document.getElementById('font-size-display') as HTMLElement;

let currentFontSize = 14;

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

themeSelect.addEventListener('change', () => {
    document.body.className = '';
    if (themeSelect.value === 'light') {
        document.body.classList.add('theme-light');
    } else if (themeSelect.value === 'hc') {
        document.body.classList.add('theme-hc');
    }
});

function updateFontSize() {
    fontSizeDisplay.textContent = currentFontSize + 'px';
    document.documentElement.style.setProperty('--editor-font-size', currentFontSize + 'px');
}

btnFontInc.addEventListener('click', () => {
    if (currentFontSize < 32) {
        currentFontSize += 2;
        updateFontSize();
    }
});

btnFontDec.addEventListener('click', () => {
    if (currentFontSize > 10) {
        currentFontSize -= 2;
        updateFontSize();
    }
});

updateFontSize();
