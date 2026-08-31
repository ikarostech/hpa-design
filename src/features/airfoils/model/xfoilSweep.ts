export function createXfoilAlphaSequences(start: number, end: number, step: number): number[][] {
  const values = makeAlphaSweep(start, end, step);
  const nonnegative = values.filter((alpha) => alpha >= 0);
  const negative = values.filter((alpha) => alpha < 0).reverse();
  return [nonnegative, negative].filter((sequence) => sequence.length > 0);
}

function makeAlphaSweep(start: number, end: number, step: number) {
  const safeStep = Math.abs(step) > 0 ? Math.abs(step) : 1;
  const values: number[] = [];
  for (let alpha = start; alpha <= end + 1e-9; alpha += safeStep) {
    values.push(Number(alpha.toFixed(6)));
  }
  return values;
}
