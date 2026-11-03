// ail-files/editor: the deck editor as React components.
//
//   import { DeckEditor, type DeckEditorHost } from "ail-files/editor";
//   <DeckEditor initialDeck={deck} initialVersion={1} host={host} pictures={[]} pictureMode="use" logo={{ enabled: false, corner: "top-right", round: false }} />
//
// The slides down the left, the selected slide drawn as the download will draw it, its fields on the right, a toolbar for the whole slide,
// drag and resize handles on free-form slides, "ask about this slide", versions, undo and redo. It keeps no server or store of its own:
// everything that does goes through the `host` you give it (see DeckEditorHost). The look comes from ten CSS variables
// (styles/editor-tokens.css) and Tailwind utility classes (see the README for the one line that makes Tailwind find them).

export { default as DeckEditor, barButtonClass, type DeckEditorProps } from "./editor/DeckEditor.js";
export { saveBlob } from "./editor/host.js";
export type { DeckEditorHost, EditorPicture, EditorLogo, PictureMeta, AskArgs, FreeFormArgs, SaveResult } from "./editor/host.js";
// The parts, for a program that wants to build its own screen from them.
export { default as SlideStage } from "./editor/SlideStage.js";
export { default as SlideForm, ElementPanel, type PictureChoice } from "./editor/SlideForm.js";
export { default as SlideToolbar } from "./editor/SlideToolbar.js";
export { default as SlideLook, PicturePanel } from "./editor/SlideLook.js";
export { default as SlideInsert } from "./editor/SlideInsert.js";
export { default as SlideAsk } from "./editor/SlideAsk.js";
export { default as SlideHandles, type BoxRef } from "./editor/SlideHandles.js";
export { default as PictureSelect } from "./editor/PictureSelect.js";
export { default as ColorField } from "./editor/ColorField.js";
export { default as PressEffect } from "./editor/PressEffect.js";
export { default as SuccessTick } from "./editor/SuccessTick.js";
