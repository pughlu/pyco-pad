export class SkulptRunner {
  private outputDiv: HTMLElement;
  private chkSafeMode: HTMLInputElement;
  
  private outputBuffer: string[] = [];
  private bufferedLineCount: number = 0;
  private bufferedCharCount: number = 0;
  private isExecutionTerminated: boolean = false;
  
  constructor() {
    this.outputDiv = document.getElementById('output') as HTMLElement;
    this.chkSafeMode = document.getElementById('chk-safe-mode') as HTMLInputElement;
    
    document.getElementById('btn-clear')?.addEventListener('click', () => this.clearOutput());
  }

  public clearOutput() {
    this.outputDiv.innerHTML = "";
  }

  private flushBufferToScreen() {
    if (this.outputBuffer.length > 0) {
        const span = document.createElement('span');
        span.innerText = this.outputBuffer.join("");
        this.outputDiv.appendChild(span);
        this.outputBuffer = [];
    }
  }

  private outf = (text: string) => {
    if (this.isExecutionTerminated) return;

    this.outputBuffer.push(text);

    // Track lines and total string size (pseudo-memory protection)
    this.bufferedLineCount += (text.match(/\n/g) || []).length;
    this.bufferedCharCount += text.length;

    if (this.chkSafeMode && this.chkSafeMode.checked) {
        // Check for both Line limits and Byte/Character limits
        if (this.bufferedLineCount > 100 || this.bufferedCharCount > 50000) {
            this.isExecutionTerminated = true;
            this.flushBufferToScreen();

            const s = document.createElement('span');
            s.className = 'output-error';

            if (this.bufferedLineCount > 100) {
                s.innerText = "\n\n[Safe Mode Error]: Code terminated. Generated output exceeded 100 lines.";
            } else {
                s.innerText = "\n\n[Safe Mode Error]: Code terminated. Output exceeded memory limits (50,000 characters).";
            }

            this.outputDiv.appendChild(s);
            this.outputDiv.scrollTop = this.outputDiv.scrollHeight;

            throw new Error("Output limit exceeded");
        }
    }
  }

  private builtinRead = (x: string) => {
    // @ts-ignore
    if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined) throw "Err";
    // @ts-ignore
    return Sk.builtinFiles["files"][x];
  }

  public runCode(code: string) {
    this.clearOutput();
    this.outputBuffer = [];
    this.bufferedLineCount = 0;
    this.bufferedCharCount = 0;
    this.isExecutionTerminated = false;

    // @ts-ignore
    if (typeof Sk === 'undefined') {
        const s = document.createElement('span');
        s.className = 'output-error';
        s.innerText = "\nError: Python engine is still loading. Please try again in a moment.";
        this.outputDiv.appendChild(s);
        return;
    }

    setTimeout(() => {
        const isSafeMode = this.chkSafeMode && this.chkSafeMode.checked;

        // @ts-ignore
        Sk.configure({
            output: this.outf,
            read: this.builtinRead,
            // @ts-ignore
            __future__: Sk.python3,
            execLimit: isSafeMode ? 1000 : Number.POSITIVE_INFINITY
        });

        // @ts-ignore
        Sk.misceval.asyncToPromise(() => Sk.importMainWithBody("<stdin>", false, code, true))
            .then(() => {
                if (this.isExecutionTerminated) return;
                this.flushBufferToScreen();

                const s = document.createElement('span');
                s.className = 'output-success';
                s.innerText = "\n>>> Finished successfully.";
                this.outputDiv.appendChild(s);
                this.outputDiv.scrollTop = this.outputDiv.scrollHeight;
            }, (err: any) => {
                if (this.isExecutionTerminated) return;
                this.flushBufferToScreen();

                const s = document.createElement('span');
                s.className = 'output-error';

                if (err.toString().includes("TimeLimitError")) {
                    s.innerText = "\n\n[Safe Mode Error]: Time limit exceeded. Execution timed out after 1.0 second.";
                } else {
                    s.innerText = "\n" + err.toString();
                }

                this.outputDiv.appendChild(s);
                this.outputDiv.scrollTop = this.outputDiv.scrollHeight;
            });
    }, 150);
  }
}
