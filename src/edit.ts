// ail-files/edit: everything the deck editor does to a deck, as plain functions with no user interface and no server.
//
//   import { addSlide, commit, createHistory, mergeDecks, slideToFreeForm } from "ail-files/edit";
//
// Editing operations on a deck (add, move, copy and delete slides, change a field, move and resize the parts of a free-form slide) with
// an undo history, the three-way merge for two people editing the same deck, the conversion of a slide to free-form, and the
// "ask the model to change this slide" prompt and reply parser. Prompts for making a whole file from a chat are here too.
// Pure code only: it runs in a browser, in Node and in a test. test/browser.test.ts checks that nothing here needs Node.

export * from "./edit/deckEdit.js";
export * from "./edit/deckMerge.js";
export * from "./edit/deckContext.js";
export * from "./edit/recordedMove.js";
export * from "./edit/slideToFreeForm.js";
export * from "./edit/slideAsk.js";
export * from "./edit/coverAsk.js";
export * from "./edit/describeChange.js";
export * from "./edit/slideOptionsEdit.js";
export * from "./prompts/index.js";
export * from "./edit/docEdit.js";
export * from "./edit/docAsk.js";
export * from "./edit/docContext.js";
