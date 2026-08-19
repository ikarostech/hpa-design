# HPADesign sample project

`HPADesign-Aero-Structural-MVP.json` is an importable schema-version 4 project demonstrating the current MVP:

- wing geometry, airfoils, and polar data;
- a completed VLM sweep with spanwise lift, drag, and pitching-torque distributions;
- a carbon-tube spar and an aerodynamic load case linked to the default maximum-lift VLM operating point at `alpha = 14 deg`;
- a completed beam analysis with bending/torsion capacity and reserve-factor distributions;
- matching aerodynamic and structural results ready for the integrated charts on the Results page.

The application uses this same file for a fresh default project. A valid browser recovery document remains authoritative and is not overwritten.

Regenerate the file after intentional solver or mock-input changes with:

```powershell
npx jiti scripts/generateSampleProject.ts
```
