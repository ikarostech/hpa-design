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

`Anonymized-HPA-Reference.json` is an importable schema-version 4 project converted from anonymized human-powered-aircraft design records. Aircraft, airfoil, analysis-case, and material identifiers have been replaced with generic labels for public distribution. The project contains a main-wing airfoil family, Re=450,000 XFoil polars, spanwise planform, incidence, a completed viscous-corrected LLT sweep from -3 to 5 degrees at 7.4 m/s, a legacy XFLR5 trim point, the ordered spar inner diameters, the spanwise partial-ply schedule, and a net wing load distribution at 1.5 G. Completed aerodynamic and structural results are embedded, so importing the project opens the saved result distributions without rerunning either analysis. Four XFoil polars are marked for review because one or two points outside or at the edge of the LLT operating range did not converge; their converged points remain available to LLT. Material properties absent from the source records are identified as provisional in the material notes.
