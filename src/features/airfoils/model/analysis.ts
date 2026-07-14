export interface XfoilAnalysisSettings {
  reynolds: number;
  mach: number;
  alphaStart: number;
  alphaEnd: number;
  alphaStep: number;
  ncrit: number;
  iterations: number;
}
