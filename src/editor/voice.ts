// Talking to the editor: the "Ask" box can listen instead of being typed into. The browser does the hearing (the Web Speech API), so there is
// nothing to install and no audio goes to this package. `VoiceSession` is the part with rules, kept free of React and of the browser so it
// can be tested: it listens, shows what it hears, waits for the person to stop talking, hands the sentence over once, and stays quiet while
// the work is being done. The React side is in SlideAsk.tsx.

/** The slice of the browser's SpeechRecognition that is used here. */
export interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface RecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
}

/** What the voice is doing: not on, listening, held while work is done, or unable to listen. */
export type VoiceState = "off" | "listening" | "paused" | "blocked" | "unsupported";

/** How long a quiet spell ends the sentence while the browser is still unsure the person has finished. */
export const VOICE_PAUSE_MS = 1300;
/** How long after the browser itself marks the sentence final: it has already waited for silence, so only a short extra beat is needed. */
export const VOICE_FINAL_PAUSE_MS = 600;

export interface VoiceOptions {
  /** Makes a fresh recognizer, or null when the browser cannot listen. */
  create: () => RecognitionLike | null;
  lang: string;
  /** How long a silence ends the sentence while the browser has not marked it final. */
  pauseMs?: number;
  /** The shorter wait once the browser has marked the sentence final. */
  finalPauseMs?: number;
  /** What has been heard so far in this sentence, as it grows. */
  onHeard: (text: string) => void;
  /** The sentence is finished (the person paused). The session is already paused: call resume() when the work is done. */
  onSentence: (text: string) => void;
  onState: (state: VoiceState) => void;
}

export class VoiceSession {
  private rec: RecognitionLike | null = null;
  private wanted = false;
  private held = false;
  private carry = ""; // earlier recognizer runs of the same sentence (the browser ends a run now and then)
  private run = ""; // the current run
  private timer: ReturnType<typeof setTimeout> | null = null;
  private restart: ReturnType<typeof setTimeout> | null = null;
  private state: VoiceState = "off";

  constructor(private readonly o: VoiceOptions) {}

  private set(state: VoiceState) {
    if (state !== this.state) {
      this.state = state;
      this.o.onState(state);
    }
  }

  private text(): string {
    return `${this.carry} ${this.run}`.replace(/\s+/g, " ").trim();
  }

  /** Turns the voice on. Call it from a tap, because browsers ask for the microphone only after one. */
  start(): void {
    this.wanted = true;
    this.held = false;
    this.begin();
  }

  /** Turns the voice off for good (until start() again). */
  stop(): void {
    this.wanted = false;
    this.held = false;
    this.clear();
    this.end();
    this.carry = "";
    this.run = "";
    this.set("off");
  }

  /** Holds the voice while work is done: nothing is heard, nothing is sent. */
  pause(): void {
    if (!this.wanted) return;
    this.held = true;
    this.clear();
    this.end();
    this.carry = "";
    this.run = "";
    this.set("paused");
  }

  /** Picks the voice up again after the work. */
  resume(): void {
    if (!this.wanted) return;
    this.held = false;
    this.begin();
  }

  private clear() {
    if (this.timer) clearTimeout(this.timer);
    if (this.restart) clearTimeout(this.restart);
    this.timer = null;
    this.restart = null;
  }

  private end() {
    const rec = this.rec;
    this.rec = null;
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.abort();
    } catch {
      /* already stopped */
    }
  }

  private begin() {
    if (!this.wanted || this.held || this.rec) return;
    const rec = this.o.create();
    if (!rec) {
      this.wanted = false;
      this.set("unsupported");
      return;
    }
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.o.lang;
    rec.onresult = (event) => {
      let heard = "";
      for (let i = 0; i < event.results.length; i++) heard += `${event.results[i][0]?.transcript ?? ""} `;
      this.run = heard;
      const text = this.text();
      if (text) this.o.onHeard(text);
      if (this.timer) clearTimeout(this.timer);
      // Every new word moves the end of the sentence back. A quiet spell closes it: a short one when the browser has already decided the
      // person is done (the last result is final), a little longer when it has not.
      const last = event.results[event.results.length - 1];
      const wait = last?.isFinal ? (this.o.finalPauseMs ?? VOICE_FINAL_PAUSE_MS) : (this.o.pauseMs ?? VOICE_PAUSE_MS);
      this.timer = setTimeout(() => this.finish(), wait);
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.wanted = false;
        this.clear();
        this.end();
        this.set("blocked");
      }
      // "no-speech", "aborted" and network blips just end the run: onend starts the next one.
    };
    rec.onend = () => {
      // The browser ends a run after a while or on silence. Carry what was heard and listen again.
      if (this.rec !== rec) return;
      this.rec = null;
      this.carry = this.text();
      this.run = "";
      if (this.wanted && !this.held) this.restart = setTimeout(() => this.begin(), 250);
    };
    this.rec = rec;
    this.set("listening");
    try {
      rec.start();
    } catch {
      /* start() throws if a run is already open; the next onend retries */
    }
  }

  private finish() {
    this.timer = null;
    const text = this.text();
    if (!text) return;
    this.pause();
    this.o.onSentence(text);
  }
}

/** Is this the person asking the voice to stop? ("stop", "stop listening", "stop voice", "turn off voice"...) */
export function isStopCommand(text: string): boolean {
  return /^(please )?(stop|turn off|end)( the)?( listening| voice| talking| mic| microphone)?[.!]?$/i.test(text.trim());
}

type RecognitionCtor = new () => RecognitionLike;

/** The browser's recognizer, if it has one (Chrome, Edge and Safari do; Firefox does not). */
export function browserRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Browsers (iOS Safari above all) only let a page speak after something the person tapped. Call this inside the tap that starts talk mode, so replies can be spoken later. */
export function primeSpeech(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    /* not available: replies just stay silent */
  }
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const base = lang.slice(0, 2).toLowerCase();
  return voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ?? voices.find((v) => v.lang.toLowerCase().startsWith(base) && v.localService) ?? voices.find((v) => v.lang.toLowerCase().startsWith(base));
}

/** Says a short line aloud and resolves when it has been said (or after a safety timeout, or at once if the browser cannot speak). */
export function speak(text: string, lang: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return resolve();
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        clearTimeout(guard);
        resolve();
      }
    };
    const guard = setTimeout(finish, 15000);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(u);
  });
}

export interface NarrateOptions {
  /** Says one line aloud and resolves when it has been said. */
  say: (text: string) => Promise<void>;
  /** A quick, specific acknowledgement ("Sure, making the title bigger.") that may or may not arrive in time. */
  acknowledge: Promise<string | null>;
  /** Said if the acknowledgement is not here after `ackWaitMs`, so the person hears something at once. */
  generic: string;
  /** Said, one at a time, while the work is still going, so it never goes quiet. */
  fillers: string[];
  ackWaitMs?: number;
  fillerEveryMs?: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Keeps the assistant talking while the work is done, so it feels active: an acknowledgement as soon as there is one (a specific one if it comes
 * quickly, otherwise a generic one), then a short filler every few seconds while the work goes on. It stops the moment the work is over and
 * resolves once whatever is being said has ended, so the caller can then say the result without talking over it. It never says anything for
 * work that is already finished.
 */
export async function narrateWhile(work: Promise<unknown>, o: NarrateOptions): Promise<void> {
  let finished = false;
  void work.then(
    () => (finished = true),
    () => (finished = true),
  );
  // Settle `finished` before the first check (a promise that is already resolved needs a tick).
  await Promise.resolve();
  if (finished) return;

  const specific = await Promise.race([o.acknowledge.catch(() => null), sleep(o.ackWaitMs ?? 900).then(() => undefined)]);
  if (finished) return;
  await o.say(specific || o.generic);

  for (const filler of o.fillers) {
    // Wait for the next gap, giving up the moment the work ends.
    for (let waited = 0; waited < (o.fillerEveryMs ?? 3500) && !finished; waited += 100) await sleep(100);
    if (finished) return;
    await o.say(filler);
  }
}
