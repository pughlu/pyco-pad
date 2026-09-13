export class Editor {
  private editing: HTMLTextAreaElement;
  private highlighting: HTMLElement;
  private highlightingContent: HTMLElement;
  private lineNumbers: HTMLElement;
  private currentLineCount: number = 0;
  private pendingHighlightText: string | null = null;
  private rafHighlightId: number | null = null;
  
  constructor() {
    this.editing = document.getElementById('editing') as HTMLTextAreaElement;
    this.highlighting = document.getElementById('highlighting') as HTMLElement;
    this.highlightingContent = document.getElementById('highlighting-content') as HTMLElement;
    this.lineNumbers = document.getElementById('line-numbers') as HTMLElement;
    
    this.setupListeners();
    this.setupLayout();
  }
  
  private setupListeners() {
    this.editing.addEventListener('input', () => {
      this.updateView(this.editing.value);
      this.syncScroll();
    });
    
    this.editing.addEventListener('scroll', () => {
      this.syncScroll();
    });
    
    this.editing.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.editing.addEventListener('paste', (e) => this.handlePaste(e));
  }
  
  public getValue(): string {
    return this.editing.value;
  }
  
  public setValue(text: string) {
    this.editing.value = text;
    this.updateView(text, true);
  }
  
  public setReadOnly(readOnly: boolean) {
    this.editing.readOnly = readOnly;
  }
  
  public get isReadOnly(): boolean {
    return this.editing.readOnly;
  }
  
  public insertContent(content: string) {
    if (this.isReadOnly) return;
    const start = this.editing.selectionStart;
    const end = this.editing.selectionEnd;
    
    this.editing.value = 
      this.editing.value.substring(0, start) + 
      content + 
      this.editing.value.substring(end);
      
    this.editing.selectionStart = this.editing.selectionEnd = start + content.length;
    this.editing.focus();
    
    this.updateView(this.editing.value, true);
    this.editing.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  private updateView(text: string, immediate: boolean = false) {
    this.updateLineNumbers(text);
    
    if (immediate) {
      if (this.rafHighlightId !== null) {
        cancelAnimationFrame(this.rafHighlightId);
        this.rafHighlightId = null;
      }
      this.pendingHighlightText = null;
      let result_text = text;
      if (text[text.length - 1] === '\n') result_text += ' ';
      this.highlightingContent.innerHTML = this.highlightPython(result_text);
      this.syncScroll();
      return;
    }

    this.pendingHighlightText = text;
    if (this.rafHighlightId === null) {
      this.rafHighlightId = requestAnimationFrame(() => {
        this.rafHighlightId = null;
        const currentText = this.pendingHighlightText ?? this.editing.value;
        this.pendingHighlightText = null;
        let result_text = currentText;
        if (currentText[currentText.length - 1] === '\n') result_text += ' ';
        this.highlightingContent.innerHTML = this.highlightPython(result_text);
        this.syncScroll();
      });
    }
  }
  
  private syncScroll() {
    this.highlighting.scrollTop = this.editing.scrollTop;
    this.highlighting.scrollLeft = this.editing.scrollLeft;
    this.lineNumbers.scrollTop = this.editing.scrollTop;
  }
  
  private updateLineNumbers(text: string) {
    const lines = text.split('\n').length;
    if (lines !== this.currentLineCount) {
      let nums = '';
      for (let i = 1; i <= lines; i++) {
        nums += i + '\n';
      }
      this.lineNumbers.textContent = nums;
      this.currentLineCount = lines;
    }
  }

  // --- SMART TYPING HELPERS ---
  private insertTextAtCursor(text: string) {
    this.editing.focus();
    if (!document.execCommand('insertText', false, text)) {
      const start = this.editing.selectionStart;
      const end = this.editing.selectionEnd;
      this.editing.value = this.editing.value.substring(0, start) + text + this.editing.value.substring(end);
      this.editing.selectionStart = this.editing.selectionEnd = start + text.length;
      this.updateView(this.editing.value);
    }
  }
  
  private deleteSelectedText() {
    this.editing.focus();
    if (!document.execCommand('delete', false, '')) {
      const start = this.editing.selectionStart;
      const end = this.editing.selectionEnd;
      this.editing.value = this.editing.value.substring(0, start) + this.editing.value.substring(end);
      this.editing.selectionStart = this.editing.selectionEnd = start;
      this.updateView(this.editing.value);
    }
  }
  
  private getLineIndent(text: string, index: number): string {
    const lineStart = text.lastIndexOf('\n', index - 1) + 1;
    let i = lineStart;
    while (i < text.length && (text[i] === ' ' || text[i] === '\t')) {
        i++;
    }
    return text.substring(lineStart, i);
  }
  
  private findMatchingBracket(text: string, closeIndex: number): number | null {
    const closeChar = text[closeIndex];
    const openChar = closeChar === ')' ? '(' : (closeChar === ']' ? '[' : '{');
    let depth = 1;
    for (let i = closeIndex - 1; i >= 0; i--) {
        const c = text[i];
        if (c === closeChar) depth++;
        else if (c === openChar) depth--;
        if (depth === 0) return i;
    }
    return null;
  }
  
  private analyzeLineBrackets(line: string) {
    let stack = [];
    let inString = false;
    let stringChar: string | null = null;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inString) {
            if (char === stringChar && line[i - 1] !== '\\') inString = false;
            continue;
        }
        if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
            continue;
        }
        if (char === '#') break;

        if (['(', '[', '{'].includes(char)) {
            stack.push({ char, index: i });
        } else if ([']', ')', '}'].includes(char)) {
            if (stack.length > 0) {
                const last = stack[stack.length - 1];
                if ((char === ']' && last.char === '[') ||
                    (char === ')' && last.char === '(') ||
                    (char === '}' && last.char === '{')) {
                    stack.pop();
                }
            }
        }
    }
    return stack;
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.isReadOnly) return;
    
    const textarea = this.editing;
    const val = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (e.key === "Tab") {
        e.preventDefault();
        this.insertTextAtCursor("    ");
    }
    else if (e.key === "Backspace") {
        if (start === end && start > 0) {
            const lineStart = val.lastIndexOf('\n', start - 1) + 1;
            const textBeforeCursor = val.substring(lineStart, start);

            if (/^\s+$/.test(textBeforeCursor) && textBeforeCursor.length >= 4) {
                const fourCharsBefore = val.substring(start - 4, start);
                if (fourCharsBefore === "    ") {
                    e.preventDefault();
                    textarea.selectionStart = start - 4;
                    textarea.selectionEnd = start;
                    this.deleteSelectedText();
                }
            }
        }
    }
    else if (e.key === "Enter") {
        if (e.ctrlKey || e.metaKey) {
            // handled by main runCode listener
            return;
        }
        e.preventDefault();
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        const currentLine = val.substring(lineStart, start);
        const trimmed = currentLine.trimEnd();

        let nextIndent = "";
        const bracketStack = this.analyzeLineBrackets(currentLine);
        const lineWithoutComment = currentLine.split('#')[0].trimEnd();

        if (bracketStack.length > 0) {
            const lastOpen = bracketStack[bracketStack.length - 1];
            nextIndent = " ".repeat(lastOpen.index + 1);
        }
        else if (lineWithoutComment.endsWith(":")) {
            const beforeColon = lineWithoutComment.slice(0, -1).trimEnd();
            const lastCharBeforeColon = beforeColon.charAt(beforeColon.length - 1);
            if ([')', ']', '}'].includes(lastCharBeforeColon)) {
                const closeIndex = lineStart + currentLine.lastIndexOf(lastCharBeforeColon);
                const openIndex = this.findMatchingBracket(val, closeIndex);
                if (openIndex !== null) {
                    nextIndent = this.getLineIndent(val, openIndex) + "    ";
                } else {
                    nextIndent = this.getLineIndent(val, start) + "    ";
                }
            } else {
                nextIndent = this.getLineIndent(val, start) + "    ";
            }
        }
        else if ([')', ']', '}'].includes(trimmed.charAt(trimmed.length - 1))) {
            const lastChar = trimmed.charAt(trimmed.length - 1);
            const closeIndex = lineStart + currentLine.lastIndexOf(lastChar);
            const openIndex = this.findMatchingBracket(val, closeIndex);
            if (openIndex !== null) {
                nextIndent = this.getLineIndent(val, openIndex);
            } else {
                nextIndent = this.getLineIndent(val, start);
            }
        }
        else {
            nextIndent = this.getLineIndent(val, start);
        }

        const insertion = "\n" + nextIndent;
        this.insertTextAtCursor(insertion);

        requestAnimationFrame(() => {
            this.syncScroll();
        });
    }
  }

  private handlePaste(e: ClipboardEvent) {
    if (this.isReadOnly) return;
    
    const clipboardData = e.clipboardData || (window as any).clipboardData;
    if (!clipboardData) return;
    e.preventDefault();

    let html = clipboardData.getData('text/html');
    let text = clipboardData.getData('text');

    if (html && html.trim().length > 0) {
        let processed = html.replace(/<style([\s\S]*?)<\/style>/gi, '');
        processed = processed.replace(/<script([\s\S]*?)<\/script>/gi, '');
        processed = processed.replace(/(<[a-z0-9]+)\s+[^>]+(?=>)/gi, '$1');
        processed = processed.replace(/<br\s*\/?>/gi, "\n");
        processed = processed.replace(/<\/div>/ig, '\n');
        processed = processed.replace(/<\/p>/ig, '\n');
        processed = processed.replace(/<\/li>/ig, '\n');
        processed = processed.replace(/<li>/ig, '  * ');
        processed = processed.replace(/<\/ul>/ig, '\n');
        processed = processed.replace(/<[^>]+>/ig, '');

        text = processed
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

        text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

        const rawPlainText = clipboardData.getData('text') || "";
        if (rawPlainText) {
            if (!/^\s/.test(rawPlainText)) text = text.trimStart();
            if (!/\s$/.test(rawPlainText)) text = text.trimEnd();
        } else {
            text = text.trimEnd();
        }
    } else if (text) {
        text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    }

    if (text) {
        this.insertTextAtCursor(text);
        this.syncScroll();
        this.editing.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // --- SYNTAX HIGHLIGHTING ---
  private unescapeHtml(text: string) {
    return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  }

  private highlightPython(code: string) {
    code = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const tokenRegex = /((?:#).*?$)|((?:\b[fF])?(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'))|\b(def|class|import|from|return|if|else|elif|while|for|in|print|try|except|raise|True|False|None|as|with|finally|yield|lambda|pass|break|continue|and|or|not|is|self)\b|(\b\d+\b)|(@\w+)/gm;

    return code.replace(tokenRegex, (match, comment, string, keyword, number, decorator) => {
        if (comment) return `<span class="token-comment">${comment}</span>`;
        if (string) {
            if (string.startsWith('f') || string.startsWith('F')) {
                const formattedString = string.replace(/\{.*?\}/g, (interp: string) => {
                    const inner = interp.slice(1, -1);
                    return `<span style="color: #d4d4d4;">{${this.highlightPython(this.unescapeHtml(inner))}}</span>`;
                });
                return `<span class="token-fstring">${formattedString}</span>`;
            }
            return `<span class="token-string">${string}</span>`;
        }
        if (keyword) return `<span class="token-keyword">${keyword}</span>`;
        if (number) return `<span class="token-number">${number}</span>`;
        if (decorator) return `<span class="token-decorator">${decorator}</span>`;
        return match;
    });
  }
  
  // --- LAYOUT & RESIZING LOGIC ---
  private setupLayout() {
    const container = document.getElementById('main-container') as HTMLElement;
    const resizer = document.getElementById('resizer') as HTMLElement;
    const editorWrapper = document.getElementById('editor-wrapper') as HTMLElement;
    const outputWrapper = document.getElementById('output-wrapper') as HTMLElement;
    const layoutIcon = document.getElementById('layout-icon') as HTMLElement;
    const btnLayout = document.getElementById('btn-layout') as HTMLButtonElement;
    const btnHideOutput = document.getElementById('btn-hide-output') as HTMLButtonElement;
    const btnShowOutput = document.getElementById('btn-show-output') as HTMLButtonElement;
    
    let layoutMode = 0;
    
    const toggleLayout = (forceMode = -1) => {
      if (forceMode !== -1) {
          layoutMode = forceMode;
      } else {
          layoutMode = (layoutMode + 1) % 3;
      }

      container.className = "container";
      editorWrapper.style.flexBasis = "";
      outputWrapper.style.flexBasis = "";
      editorWrapper.style.height = "";
      outputWrapper.style.height = "";
      editorWrapper.style.width = "";
      outputWrapper.style.width = "";

      if (layoutMode === 0) {
          container.classList.add("vertical-split");
          layoutIcon.innerText = "◫";
          resizer.style.display = "block";
      } else if (layoutMode === 1) {
          container.classList.add("horizontal-split");
          layoutIcon.innerText = "☰";
          resizer.style.display = "block";
      } else {
          container.classList.add("output-hidden");
          layoutIcon.innerText = "□";
      }
    };
    
    btnLayout.addEventListener('click', () => toggleLayout());
    btnHideOutput.addEventListener('click', () => toggleLayout(2));
    btnShowOutput.addEventListener('click', () => toggleLayout(0));
    
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizer.classList.add('active');
        document.body.style.cursor = layoutMode === 0 ? 'col-resize' : 'row-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const containerRect = container.getBoundingClientRect();

        if (layoutMode === 0) {
            let x = e.clientX - containerRect.left;
            let percent = (x / containerRect.width) * 100;
            if (percent < 10) percent = 10;
            if (percent > 90) percent = 90;

            editorWrapper.style.flexBasis = percent + '%';
            outputWrapper.style.flexBasis = (100 - percent) + '%';
        } else if (layoutMode === 1) {
            let y = e.clientY - containerRect.top;
            let percent = (y / containerRect.height) * 100;
            if (percent < 10) percent = 10;
            if (percent > 90) percent = 90;

            editorWrapper.style.flexBasis = percent + '%';
            outputWrapper.style.flexBasis = (100 - percent) + '%';
        }
    });

    document.getElementById('editor-wrapper')?.addEventListener('mouseenter', () => {
        if (document.activeElement !== this.editing) {
            this.editing.focus({ preventScroll: true });
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('active');
            document.body.style.cursor = 'default';
        }
    });
  }
}
