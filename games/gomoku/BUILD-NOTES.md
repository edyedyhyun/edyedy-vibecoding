# Build Notes

- Source files: `engine.js`, `app.js`, `index.html`. All authored directly, no external libraries or CDNs.
- `build.py` inlines `engine.js` and `app.js` into `index.html`'s `<script src>` tags to produce the single-file `gomoku.html`.
- `build.py` was not executed in this environment (shell access was not available while producing this deliverable). Instead, `gomoku.html` was hand-assembled by copying the current contents of `engine.js` and `app.js` verbatim into `index.html` in place of the `<script src>` tags, matching exactly what `build.py` would produce. Anyone with shell access can regenerate it by running `python3 build.py` and diffing against the committed `gomoku.html` to confirm they match.
- No automated tests were written or run for this deliverable, and no manual play-testing was performed. The rules and interactions described in `README.md` reflect the implementation as written, not observed play sessions.
