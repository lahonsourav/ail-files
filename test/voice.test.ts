import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceSession, isStopCommand, narrateWhile, parseNavCommand, type RecognitionEventLike, type RecognitionLike, type VoiceState } from "../src/editor/voice.js";

class FakeRecognition implements RecognitionLike {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((e: RecognitionEventLike) => void) | null = null;
  onerror: ((e: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = 0;
  aborted = false;
  start() {
    this.started++;
  }
  stop() {}
  abort() {
    this.aborted = true;
  }
  say(...words: string[]) {
    this.onresult?.({ results: words.map((w) => [{ transcript: w }]) });
  }
  /** The browser marks the last thing said as final. */
  sayFinal(...words: string[]) {
    this.onresult?.({ results: words.map((w) => Object.assign([{ transcript: w }], { isFinal: true })) });
  }
}

function setup(over: { create?: () => RecognitionLike | null } = {}) {
  const recs: FakeRecognition[] = [];
  const heard: string[] = [];
  const sentences: string[] = [];
  const states: VoiceState[] = [];
  const v = new VoiceSession({
    create: over.create ?? (() => (recs.push(new FakeRecognition()), recs[recs.length - 1])),
    lang: "en-IN",
    onHeard: (t) => heard.push(t),
    onSentence: (t) => sentences.push(t),
    onState: (s) => states.push(s),
  });
  return { v, recs, heard, sentences, states };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("talking to the editor", () => {
  it("starts listening, follows what it hears, and sends the sentence after a quiet spell", () => {
    const { v, recs, heard, sentences, states } = setup();
    v.start();
    expect(states).toEqual(["listening"]);
    expect(recs[0].continuous).toBe(true);
    expect(recs[0].interimResults).toBe(true);
    expect(recs[0].lang).toBe("en-IN");
    recs[0].say("make it");
    recs[0].say("make it shorter");
    expect(heard).toEqual(["make it", "make it shorter"]);
    vi.advanceTimersByTime(1200);
    expect(sentences).toEqual([]); // not yet: the quiet spell has not passed
    vi.advanceTimersByTime(150);
    expect(sentences).toEqual(["make it shorter"]);
  });

  it("sends sooner once the browser itself marks the sentence final", () => {
    const { v, recs, sentences } = setup();
    v.start();
    recs[0].sayFinal("make it shorter");
    vi.advanceTimersByTime(500);
    expect(sentences).toEqual([]);
    vi.advanceTimersByTime(150);
    expect(sentences).toEqual(["make it shorter"]);
  });

  it("goes back to the longer wait if the person carries on after a final result", () => {
    const { v, recs, sentences } = setup();
    v.start();
    recs[0].sayFinal("make it shorter");
    vi.advanceTimersByTime(400);
    recs[0].say("make it shorter and");
    vi.advanceTimersByTime(900);
    expect(sentences).toEqual([]);
    vi.advanceTimersByTime(500);
    expect(sentences).toEqual(["make it shorter and"]);
  });

  it("keeps waiting while the person keeps talking: every new word moves the end back", () => {
    const { v, recs, sentences } = setup();
    v.start();
    recs[0].say("put my poster");
    vi.advanceTimersByTime(1000);
    recs[0].say("put my poster on the right");
    vi.advanceTimersByTime(1000);
    expect(sentences).toEqual([]);
    vi.advanceTimersByTime(400);
    expect(sentences).toEqual(["put my poster on the right"]);
  });

  it("is held after a sentence and hears nothing until it is resumed (the work is being done)", () => {
    const { v, recs, sentences, states } = setup();
    v.start();
    recs[0].say("make it shorter");
    vi.advanceTimersByTime(1400);
    expect(states[states.length - 1]).toBe("paused");
    expect(recs[0].aborted).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(recs).toHaveLength(1); // no new listening while held
    v.resume();
    expect(states[states.length - 1]).toBe("listening");
    expect(recs).toHaveLength(2);
    recs[1].say("now make it darker");
    vi.advanceTimersByTime(1400);
    expect(sentences).toEqual(["make it shorter", "now make it darker"]);
  });

  it("can be held and resumed from outside (a layout change from the toolbar)", () => {
    const { v, recs, states } = setup();
    v.start();
    v.pause();
    expect(states[states.length - 1]).toBe("paused");
    v.resume();
    expect(states[states.length - 1]).toBe("listening");
    expect(recs).toHaveLength(2);
  });

  it("does not send a sentence it only half heard when held in the middle of it", () => {
    const { v, recs, sentences } = setup();
    v.start();
    recs[0].say("make the back");
    v.pause();
    vi.advanceTimersByTime(5000);
    expect(sentences).toEqual([]);
  });

  it("listens again by itself when the browser ends a run, and keeps the words of the same sentence", () => {
    const { v, recs, sentences } = setup();
    v.start();
    recs[0].say("make the title");
    recs[0].onend?.(); // the browser closes the run
    vi.advanceTimersByTime(300);
    expect(recs).toHaveLength(2);
    recs[1].say("bigger");
    vi.advanceTimersByTime(1400);
    expect(sentences).toEqual(["make the title bigger"]);
  });

  it("goes quiet and says so when the microphone is refused", () => {
    const { v, recs, states } = setup();
    v.start();
    recs[0].onerror?.({ error: "not-allowed" });
    expect(states[states.length - 1]).toBe("blocked");
    recs[0].onend?.();
    vi.advanceTimersByTime(1000);
    expect(recs).toHaveLength(1);
  });

  it("ignores a no-speech error: it just listens again", () => {
    const { v, recs, states } = setup();
    v.start();
    recs[0].onerror?.({ error: "no-speech" });
    recs[0].onend?.();
    vi.advanceTimersByTime(300);
    expect(states[states.length - 1]).toBe("listening");
    expect(recs).toHaveLength(2);
  });

  it("reports a browser that cannot listen", () => {
    const { v, states } = setup({ create: () => null });
    v.start();
    expect(states).toEqual(["unsupported"]);
  });

  it("stop() ends it for good", () => {
    const { v, recs, states, sentences } = setup();
    v.start();
    recs[0].say("something");
    v.stop();
    vi.advanceTimersByTime(5000);
    expect(states[states.length - 1]).toBe("off");
    expect(sentences).toEqual([]);
    v.resume();
    expect(recs).toHaveLength(1);
  });
});

describe("the stop command", () => {
  it("recognises the spoken ways of ending talk mode, and nothing else", () => {
    for (const s of ["stop", "Stop.", "stop listening", "please stop", "turn off voice", "end the voice", "stop talking"]) expect(isStopCommand(s), s).toBe(true);
    for (const s of ["stop the title from wrapping", "make it shorter", "don't stop", "bus stop sign on the right"]) expect(isStopCommand(s), s).toBe(false);
  });
});

describe("keeping the assistant talking while it works", () => {
  const setupNarration = (work: Promise<unknown>, ack: Promise<string | null>, over: Partial<Parameters<typeof narrateWhile>[1]> = {}) => {
    const said: string[] = [];
    const done = narrateWhile(work, {
      say: (t) => (said.push(t), new Promise((r) => setTimeout(r, 400))), // each line takes 0.4 s to say
      acknowledge: ack,
      generic: "Okay, working on it.",
      fillers: ["Still on it.", "Almost there."],
      ...over,
    });
    return { said, done };
  };
  const later = <T>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));

  it("says the specific acknowledgement when it arrives quickly, then a filler while the work goes on", async () => {
    const { said, done } = setupNarration(later(6000, "ok"), later(300, "Sure, making the title bigger."));
    await vi.advanceTimersByTimeAsync(400);
    expect(said).toEqual(["Sure, making the title bigger."]);
    await vi.advanceTimersByTimeAsync(4300);
    expect(said).toEqual(["Sure, making the title bigger.", "Still on it."]);
    await vi.advanceTimersByTimeAsync(2000);
    await done;
    expect(said).toContain("Still on it.");
  });

  it("says a generic line when the specific one is slow, and drops the late one", async () => {
    const { said, done } = setupNarration(later(3000, "ok"), later(2500, "Sure, making the title bigger."));
    await vi.advanceTimersByTimeAsync(1000);
    expect(said).toEqual(["Okay, working on it."]);
    await vi.advanceTimersByTimeAsync(3000);
    await done;
    expect(said).not.toContain("Sure, making the title bigger.");
  });

  it("says nothing for work that is already done, and stops the moment the work finishes", async () => {
    const quick = setupNarration(Promise.resolve("ok"), later(100, "Sure."));
    await vi.advanceTimersByTimeAsync(50);
    await quick.done;
    expect(quick.said).toEqual([]);

    const { said, done } = setupNarration(later(1500, "ok"), later(100, "Sure, making it darker."));
    await vi.advanceTimersByTimeAsync(5000);
    await done;
    expect(said).toEqual(["Sure, making it darker."]); // no filler: the work ended before the first one was due
  });

  it("does not fail when the work fails or the acknowledgement fails", async () => {
    const failed = setupNarration(later(1000, null).then(() => Promise.reject(new Error("x"))), Promise.reject(new Error("no ack")));
    failed.done.catch(() => {});
    await vi.advanceTimersByTimeAsync(3000);
    await expect(failed.done).resolves.toBeUndefined();
  });
});

describe("moving between slides by voice", () => {
  it.each([
    ["next", { to: "next" }],
    ["Next slide.", { to: "next" }],
    ["go to next page", { to: "next" }],
    ["Go to the next slide please", { to: "next" }],
    ["okay next slide", { to: "next" }],
    ["move on", { to: "next" }],
    ["go forward", { to: "next" }],
    ["previous slide", { to: "previous" }],
    ["go to the previous page", { to: "previous" }],
    ["go back", { to: "previous" }],
    ["back", { to: "previous" }],
    ["first slide", { to: "first" }],
    ["go to the beginning", { to: "first" }],
    ["last slide", { to: "last" }],
    ["go to the final page", { to: "last" }],
    ["go to slide 3", { to: "number", n: 3 }],
    ["slide five", { to: "number", n: 5 }],
    ["Go to page 12.", { to: "number", n: 12 }],
  ])("%s", (said, want) => expect(parseNavCommand(said)).toEqual(want));

  it.each(["next, make the title bigger", "make the next slide shorter", "go to slide zero", "the next big thing", "make the text bigger", "stop", ""])("is not a command: %s", (said) => expect(parseNavCommand(said)).toBeNull());
});
