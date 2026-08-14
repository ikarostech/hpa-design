# AVL 3.52 simple-wing reference

This fixture records the external reference used by `vlmSolver.test.ts`.

- Solver: MIT Athena Vortex Lattice 3.52 for Windows
- Solver download: <https://web.mit.edu/drela/Public/web/avl/avl352.exe>
- Solver SHA-256: `443520D255408491222A8DF9060BD000F78DA95A68845A2F6EFDBC67E203F07A`
- Input source: <https://web.mit.edu/drela/Public/web/avl/runs/wing.avl>
- Retrieved and executed: 2026-08-10

`wing.avl` is the unmodified official sample input. `run-commands.txt` contains
the non-interactive OPER commands used for the three angles of attack.
`total-forces.txt` is the concatenation of the three AVL `FT` files. The test
uses `CLtot` and `CDind`; profile drag is zero in this inviscid reference.

The AVL executable is intentionally not committed. Download it from the URL
above and verify its hash before reproducing the run.
