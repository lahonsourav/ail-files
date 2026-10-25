// Approximate text-fit for canvas-layout slides (see lib/presentationBuilder.ts's
// renderCanvasSlide). pptxgenjs's own `fit: "shrink"/"resize"` option is a
// dead end for this — per its own type docs, it "only takes effect after
// editing text/resize shape" interactively in PowerPoint, never at
// file-generation time. So this estimates wrapped text height ourselves and
// shrinks the font size until it fits, before the file is ever written.
//
// Calibri/Georgia/Arial/Arial Black are proprietary Microsoft/Monotype
// fonts — we don't have the actual font files to extract exact glyph
// metrics from, so these are calibrated average-character-width
// approximations, not precise measurements. Deliberately conservative
// (biased toward slightly over- rather than under-estimating width) since
// clipped text is a worse failure than a slightly smaller-than-necessary
// font size.
export const FONT_AVG_WIDTH_EM: Record<string, number> = {
  Calibri: 0.5,
  Georgia: 0.54,
  Arial: 0.52,
  "Arial Black": 0.64,
};

const DEFAULT_AVG_EM = 0.52;
const PT_PER_INCH = 72;
const LINE_HEIGHT_FACTOR = 1.2;
const MIN_FONT_SIZE = 8;
const SHRINK_STEP = 0.9;
const MAX_SHRINK_ITERATIONS = 20;

// Enhanced character classification with more precise multipliers
function charClassMultiplier(ch: string): number {
  if (ch === " ") return 0.3;
  if ("ijltfI'\".,;:!|()[]{}<>".includes(ch)) return 0.55;
  if ("mwMW@%&".includes(ch)) return 1.55;
  if ("QO0DGRB".includes(ch)) return 1.35;
  if (/[A-Z0-9]/.test(ch)) return 1.15;
  if ("ÁÉÍÓÚáéíóúñÑçÇß".includes(ch)) return 1.2; // Accented characters
  if ("!@#$%^&*()_+-=[]{}|;:,.<>?/".includes(ch)) return 0.85; // Punctuation
  return 1.0;
}

// Improved text width estimation with better character handling
export function estimateTextWidthEm(text: string, avgEm: number): number {
  let total = 0;
  for (const ch of text) total += avgEm * charClassMultiplier(ch);
  return total;
}

// Enhanced word-wrap with better line breaking logic
export function wrapLineCount(text: string, boxWInches: number, avgEm: number, fontSizePt: number): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  
  const spaceW = (avgEm * 0.3 * fontSizePt) / PT_PER_INCH;
  let lines = 1;
  let lineW = 0;
  
  for (const word of words) {
    const wordW = (estimateTextWidthEm(word, avgEm) * fontSizePt) / PT_PER_INCH;
    
    // Handle very long words that exceed box width
    if (wordW > boxWInches) {
      // Force wrap for long words
      lines++;
      lineW = 0;
      continue;
    }
    
    const next = lineW === 0 ? wordW : lineW + spaceW + wordW;
    if (next > boxWInches && lineW > 0) {
      lines++;
      lineW = wordW;
    } else {
      lineW = next;
    }
  }
  
  return lines;
}

// New: Estimate optimal starting font size based on text length and box dimensions
export function estimateOptimalStartSize(text: string, boxW: number, boxH: number, avgEm: number): number {
  const charCount = text.length;
  const boxArea = boxW * boxH;
  
  // Rough estimate: more text = smaller starting size
  // Base calculation assuming avg character width and line height
  const avgCharWidth = avgEm / PT_PER_INCH;
  const lineHeight = 1.2 / PT_PER_INCH;
  
  // Estimate how many characters fit per line at size 12
  const charsPerLine = boxW / (avgCharWidth * 12);
  const estimatedLines = Math.ceil(charCount / charsPerLine);
  const estimatedHeight = estimatedLines * lineHeight * 12;
  
  // Scale starting size based on estimated fit
  let startSize = 12;
  if (estimatedHeight > boxH) {
    startSize = Math.max(8, 12 * (boxH / estimatedHeight));
  }
  
  return Math.min(24, Math.max(8, startSize));
}

export interface FitFontSizeOptions {
  avgEm: number;
  startSize?: number;
  minSize?: number;
  maxIterations?: number;
}

// Enhanced font size fitting with adaptive start size and better convergence
export function fitFontSize(text: string, boxW: number, boxH: number, opts: FitFontSizeOptions): number {
  const minSize = opts.minSize ?? MIN_FONT_SIZE;
  const maxIterations = opts.maxIterations ?? MAX_SHRINK_ITERATIONS;
  
  // Use adaptive start size if not provided
  let size = opts.startSize ?? estimateOptimalStartSize(text, boxW, boxH, opts.avgEm);
  
  for (let i = 0; i < maxIterations; i++) {
    const lines = wrapLineCount(text, boxW, opts.avgEm, size);
    const heightNeeded = (lines * size * LINE_HEIGHT_FACTOR) / PT_PER_INCH;
    
    if (heightNeeded <= boxH || size <= minSize) break;
    
    // Adaptive shrinking: bigger steps when far from target, smaller when close
    const excessRatio = heightNeeded / boxH;
    const adaptiveStep = excessRatio > 1.5 ? 0.85 : SHRINK_STEP;
    size = Math.max(minSize, size * adaptiveStep);
  }
  
  return Math.round(size * 10) / 10;
}

// New: Check if text fits at given size without adjusting
export function textFits(text: string, boxW: number, boxH: number, fontSizePt: number, avgEm: number): boolean {
  const lines = wrapLineCount(text, boxW, avgEm, fontSizePt);
  const heightNeeded = (lines * fontSizePt * LINE_HEIGHT_FACTOR) / PT_PER_INCH;
  return heightNeeded <= boxH;
}

// New: Get detailed text metrics for debugging/analysis
export interface TextMetrics {
  lines: number;
  estimatedWidth: number;
  estimatedHeight: number;
  fits: boolean;
  suggestedSize: number;
}

export function getTextMetrics(text: string, boxW: number, boxH: number, fontSizePt: number, avgEm: number): TextMetrics {
  const lines = wrapLineCount(text, boxW, avgEm, fontSizePt);
  const estimatedWidth = (estimateTextWidthEm(text, avgEm) * fontSizePt) / PT_PER_INCH;
  const estimatedHeight = (lines * fontSizePt * LINE_HEIGHT_FACTOR) / PT_PER_INCH;
  const fits = estimatedHeight <= boxH;
  const suggestedSize = fitFontSize(text, boxW, boxH, { avgEm, startSize: fontSizePt });
  
  return {
    lines,
    estimatedWidth,
    estimatedHeight,
    fits,
    suggestedSize,
  };
}

export function avgEmForFont(fontFace: string): number {
  return FONT_AVG_WIDTH_EM[fontFace] ?? DEFAULT_AVG_EM;
}
