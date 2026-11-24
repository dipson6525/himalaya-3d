# Open questions

Everything marked `TODO(team)` in code or docs is listed here. Tick it off (with who/when) when
resolved. Newest at the top.

| # | Question | Needed by | Who | Status |
| --- | --- | --- | --- | --- |
| Q1 | GitHub usernames of the teammates who are not `dipson6525`, so they can be invited as collaborators. | M0 | Team | Answered 2026-11-21: Unique-Ghimire and sparshgorkhali5-wq invited with write access; each must accept the e-mail invitation. |
| Q2 | Has the `CESIUM_ION_TOKEN` repository secret been set? (`gh secret set CESIUM_ION_TOKEN`) | M0 deploy | Repo owner | Open |
| Q3 | After the first deploy: restrict the production ion token's Allowed URLs to the GitHub Pages URL on ion.cesium.com. | M0 deploy | Token owner | Open |
| Q4 | Do FR1–FR9 in `docs/requirements.md` match the numbering in the submitted proposal? Are the NFR1 (≥ 30 fps) and NFR2 (≤ ~10 s first load) targets, taken from the team's setup brief, the same as in the proposal? | M1 | Team | Answered 2026-11-21 from the proposal PDF: FRs renumbered to match its Table 4.1 (old FR3–FR6 shifted); the 30 fps and 10 s targets match; NFR11 (ease of use) added. |
| Q5 | Real date of semester week 1 (milestone due dates assume Mon 2026-11-16). | M1 | Team | Open |
| Q6 | Fourth route: Manaslu Circuit (proposed) or Mardi Himal? | M2 | Team (Unique) | Open |
| Q7 | Nepali UI strings are machine-drafted — need review by a native speaker (see `docs/i18n-review.md`). | M6 | Team | Open |
| Q8 | Safety/disclaimer wording reviewed by the team (and ideally a supervisor). | M5 | Team | Open |
| Q9 | KU report format/template for the final report outline. | M8 | Team | Open |
| Q10 | This laptop's global git `user.name` contains stray text, and the global `user.email` has a typo in the domain (`student.kuedu.np` instead of `student.ku.edu.np`). Fix both with `git config --global ...`. This repo has correct local overrides. | Now | Laptop owner | Open |
| Q11 | Add the `project` scope to gh if you want a GitHub Project board: `gh auth refresh -s project`. | Optional | Repo owner | Open |
| Q12 | Turn on branch protection for `main` (require the CI checks to pass before merging)? Without it, a red PR can still be merged by mistake. | M1 | Team | Open |
| Q13 | The proposal PDF (`Himalaya_3D_Final_Proposal.pdf`) is in the project folder but not in git. Commit it to `docs/` so the report can cite it? | M8 | Team | Open |
| Q14 | The proposal was "submitted to Saugat Singh"; the setup brief named Suman Shrestha as coordinator. Which names (and roles) go in the README and the final report? | M8 | Team | Open |
| Q15 | After the 2026-11-21 history swap (ADR-020), the old history is kept in `archive/old-*` branches. Delete them once the team is sure nothing is missing? | Any time | Repo owner | Open |
| Q16 | Cesium's terrain heights are above the WGS84 ellipsoid; the cited stop altitudes are above sea level. How big is the difference (the geoid undulation) over the trek areas, and should #13 (altitude cross-check) and the 50 m disagreement rule in `data/routes/route-sources.md` correct for it? TODO(team): verify from a cited source. | #13 | Unique | Open |
