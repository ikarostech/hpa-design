# XFLR5 6.62 Flying Wing LLT reference

This fixture records the XFLR5 reference used by `lltSolver.test.ts`.

- Solver: XFLR5 6.62 for Windows
- Solver download: <https://sourceforge.net/projects/xflr5/files/6.62/xflr5_v6.62_win64.zip/download>
- Solver ZIP SHA-256: `2579B9823051BBEA78721D37C9533B7FF9CF64FEA381185C79A47A9B3A74F250`
- Sample project: <https://sourceforge.net/projects/xflr5/files/Sample_Project.zip/download>
- Sample ZIP SHA-256: `F7D3ABBE2F28E8BD4D3F20F1DABDCCB0A71EACAF9ACBBCA04069E22C5E7611D4`
- Retrieved and executed: 2026-08-14

## Procedure

1. Open the official `Sample_Project.xfl` in XFLR5 6.62.
2. Select the `Flying Wing` object.
3. Define a Type 1 fixed-speed polar at 15 m/s.
4. Select `LLT (Wing only)`. XFLR5 enables viscous analysis for LLT.
5. Keep density `1.225 kg/m3`, kinematic viscosity `1.5e-5 m2/s`, projected reference dimensions, and the default LLT settings.
6. Run a sequence from alpha 0 to 1 degree in 0.5 degree increments with `Init LLT` and `Store OpPoint` enabled.
7. Export the polar results and plane geometry.

`Flying Wing.xml` is the geometry exported by XFLR5. `T1-15_0 m_s-LLT.txt`
is the raw polar export. The official binary `Sample_Project.xfl` is not copied
here; it is reproducible from the source URL and hash above.

The first implementation slice validates the low-angle lift curve of the planar
main-wing portion. The 90-degree winglet sections in the XML are outside the
scope of classical lifting-line theory.
