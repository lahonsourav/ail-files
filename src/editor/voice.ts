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
  /** Said once when listening is not going well: nothing has been heard for several runs in a row ("silence"), or the microphone or speech service failed ("error"). */
  onTrouble?: (kind: "silence" | "error", detail?: string) => void;
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
  private quietRuns = 0; // runs in a row that ended without a word
  private troubled = false;

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
    this.quietRuns = 0;
    this.troubled = false;
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
      this.quietRuns = 0;
      this.troubled = false;
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
      else if (event.error === "audio-capture" || event.error === "network") this.o.onTrouble?.("error", event.error);
      // "no-speech", "aborted" and short network blips just end the run: onend starts the next one.
    };
    rec.onend = () => {
      // The browser ends a run after a while or on silence. Carry what was heard and listen again.
      if (this.rec !== rec) return;
      this.rec = null;
      const heardSomething = this.text() !== "";
      this.carry = this.text();
      this.run = "";
      if (!heardSomething && ++this.quietRuns >= 3 && !this.troubled) {
        this.troubled = true;
        this.o.onTrouble?.("silence");
      }
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
  const t = text.trim();
  return (
    /^(please )?(stop|turn off|end)( the)?( listening| voice| talking| mic| microphone)?[.!]?$/i.test(t) ||
    // Hindi and Hinglish: "ruko", "bas", "band karo", "bas karo".
    /^(ruko|rukiye|bas|bas karo|band karo|band kijiye|बस|रुको|रुकिए|बंद करो)[.!।]?$/i.test(t)
  );
}

/** Moving about the deck by voice: next, previous, first, last, or a slide number. */
export type NavCommand = { to: "next" | "previous" | "first" | "last" } | { to: "number"; n: number };

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

/**
 * Recognises a whole sentence that only moves between slides: "next", "next slide", "go to the next page", "previous slide", "go back",
 * "first slide", "last slide", "go to slide 3". Anything with more in it ("next, make the title bigger") is not a command, it is a request
 * for the assistant. Slide numbers count from 1.
 */
export function parseNavCommand(text: string): NavCommand | null {
  const t = text
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^((please|ok|okay|now) )+/, "")
    .replace(/( (please|now))+$/, "");
  const go = "(?:(?:go|move|jump|switch|turn|flip) (?:on )?(?:to |onto )?)?"; // "go to ", "move on to ", or nothing
  const slide = "(?: (?:slide|page|one))?";
  const the = "(?:the )?";
  // Hindi and Hinglish ("agli slide", "pichli slide", "pehli slide", "aakhri slide", and the same in Devanagari). Whole sentence only, like the English ones.
  const hiSlide = "(?: ?(?:slide|page|स्लाइड|पेज))?";
  if (new RegExp(`^(?:agli|agla|अगली|अगला)${hiSlide}(?: (?:par|pe) jao| (?:par|pe) chalo| dikhao| karo|)$`).test(t) || /^(?:aage|आगे)(?: (?:badho|jao|चलो|बढ़ो))?$/.test(t)) return { to: "next" };
  if (new RegExp(`^(?:pichli|pichhli|pichla|पिछली|पिछला)${hiSlide}(?: (?:par|pe) jao| (?:par|pe) chalo| dikhao| karo|)$`).test(t) || /^(?:peeche|piche|पीछे)(?: (?:jao|chalo|जाओ|चलो))?$/.test(t)) return { to: "previous" };
  if (new RegExp(`^(?:pehli|pahli|पहली|पहला)${hiSlide}(?: (?:par|pe) jao| dikhao|)$`).test(t)) return { to: "first" };
  if (new RegExp(`^(?:aakhri|akhri|आखिरी|अंतिम)${hiSlide}(?: (?:par|pe) jao| dikhao|)$`).test(t)) return { to: "last" };
  const word = (w: string) => new RegExp(`^${go}${the}(?:${w})${slide}$`).test(t);
  if (word("next") || /^(go |move )?(on|forward|ahead)$/.test(t)) return { to: "next" };
  if (word("previous|prev") || /^(go |move |turn |flip |jump )?(back|backward|backwards)( (one|a) (slide|page))?$/.test(t)) return { to: "previous" };
  if (word("first|start|beginning")) return { to: "first" };
  if (word("last|final")) return { to: "last" };
  const num = new RegExp(`^${go}(?:slide|page) (\\d{1,3}|${Object.keys(NUMBER_WORDS).join("|")})$`).exec(t);
  if (num) {
    const n = NUMBER_WORDS[num[1]] ?? Number(num[1]);
    if (n >= 1) return { to: "number", n };
  }
  return null;
}

/** Other whole-sentence commands: undo, redo and delete this slide (which is always confirmed first). */
export type ActionCommand = { to: "undo" | "redo" | "delete" | "confirm-delete" | "cancel-delete" };

function plain(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?।]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^((please|ok|okay|now) )+/, "")
    .replace(/( (please|now))+$/, "");
}

/** "undo", "undo that", "redo", "delete this slide", "remove this slide". Whole sentence only. */
export function parseActionCommand(text: string): ActionCommand | null {
  const t = plain(text);
  if (/^(undo|undo that|undo it|undo the last change|go back one step|step back|वापस करो|undo karo)$/.test(t)) return { to: "undo" };
  if (/^(redo|redo that|redo it|do it again|redo karo)$/.test(t)) return { to: "redo" };
  if (/^(delete|remove) (this|the current|current) (slide|page)$/.test(t) || /^(delete|remove) (slide|page)$/.test(t) || /^(is slide ko |slide )?(delete|hatao|hata do) ?(karo|do)?$/.test(t)) return { to: "delete" };
  return null;
}

/** A yes or a no to a question the assistant just asked ("Delete slide 3? Say yes or no."). */
export function parseAnswer(text: string): "yes" | "no" | null {
  const t = plain(text);
  if (/^(yes|yeah|yep|yup|sure|confirm|do it|delete it|go ahead|haan|ha|han|theek hai|हाँ|हां|ठीक है)$/.test(t)) return "yes";
  if (/^(no|nope|nah|cancel|stop|do not|don t|never mind|nevermind|keep it|nahi|nahin|mat karo|नहीं|नही)$/.test(t)) return "no";
  return null;
}

/**
 * "…change the list to a table, next slide": an edit request with a slide move at the very end. Returns the request and the move, or null.
 * The move can be set apart by a comma, a full stop, "and", "and then", "then" or "after that" ("…to a table and go to the next slide",
 * "…then slide 4", "…, agli slide"), or be the exact words "next slide" / "next page" right after the request when that does not end in a
 * preposition ("put a table in the next slide" is only an edit). A bare "back", "forward" or "move on" (without "go to", "go back") only counts after a comma, a full
 * stop or "then", since "…and back" could be part of an edit.
 */
export function splitTrailingNav(text: string): { request: string; nav: NavCommand } | null {
  const raw = text.trim().replace(/[.!?]+$/, "").trim();
  if (!raw || parseNavCommand(raw)) return null;
  const SEPARATOR = /\s*[,;.]\s*|\s+(?:and then|and also|and after that|and|then|after that)\s+/gi;
  const cuts = [...raw.matchAll(SEPARATOR)];
  for (let i = cuts.length - 1; i >= 0; i--) {
    const cut = cuts[i];
    // The request can end on a connecting word of its own ("…to a table, and then …": the cut found "then", the "and" belongs to the move).
    const head = raw.slice(0, cut.index).trim().replace(/[\s,;]+(?:and also|also|and)$/i, "").replace(/[\s,;]+$/, "");
    // After a comma the move can still start with a connecting word ("…, and then move to the next slide").
    const tail = raw.slice(cut.index + cut[0].length).trim().replace(/^(?:and then|and also|and after that|and|then|after that)\s+/i, "");
    if (head.length < 4 || !tail) continue;
    const nav = parseNavCommand(tail);
    if (!nav) continue;
    const firm = /[,;.]/.test(cut[0]) || /then|after that/i.test(cut[0]);
    if (!firm && /^(?:back|backward|backwards|forward|ahead|on|move on|go on|move forward)$/i.test(tail.replace(/\s+(?:please|now)$/i, ""))) continue;
    return { request: head, nav };
  }
  const bare = /^(.{4,}?)\s+((?:(?:go|move|jump) to )?(?:the )?next (?:slide|page)(?: please)?)$/i.exec(raw);
  if (bare && !/\b(in|on|to|of|for|at|from|after|before|and|with|into|by)$/i.test(bare[1].trim())) {
    const nav = parseNavCommand(bare[2]);
    if (nav) return { request: bare[1].trim(), nav };
  }
  return null;
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
