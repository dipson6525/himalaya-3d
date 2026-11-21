# docs/testing/ — evidence the team collects

Owner: Sparsh Gorkhali (testing lead, M7) · Issue #31

These are **templates**. Every result cell is empty on purpose: the team fills them in from real
measurements on real laptops, real connections and real people. Never type a number you did not
measure, and never copy a number from another table or from memory. If a measurement could not be
made, write "not measured" and why.

| Template | What it proves | Requirement | Filled in by |
| --- | --- | --- | --- |
| [fps-by-laptop.md](fps-by-laptop.md) | The 3D view runs at ≥ 30 fps on ordinary laptops | NFR1 | Sparsh + everyone's laptops |
| [load-time.md](load-time.md) | First load ≤ about 10 s on home broadband | NFR2 | Sparsh + everyone's connections |
| [altitude-comparison.md](altitude-comparison.md) | Published stop altitudes vs Cesium terrain; > 50 m flagged | NFR9, FR2 | Unique (#13) |
| [acclimatization-matrix.md](acclimatization-matrix.md) | The checker flags exactly the nights it should | FR5 | Unique (#23) |
| [user-questionnaire.md](user-questionnaire.md) | 10+ users: usefulness and ease of use (SUS) | NFR11, proposal 3.8 | Dipson + everyone |
| [user-questionnaire-print.html](user-questionnaire-print.html) | The same questionnaire as a printable A4 form | NFR11 | — |

## How to record a result

1. Use the live site (https://dipson6525.github.io/himalaya-3d/) unless the table says otherwise,
   and write down the commit it was built from (shown in the GitHub Actions deploy run).
2. Fill one row per measurement, with the date and who measured.
3. Commit the table in a PR titled `test(...): <what you measured>`; the progress log links to it.
