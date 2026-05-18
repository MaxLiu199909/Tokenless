---
description: Show Tokenless status, savings, and latest artifact
argument-hint: "[style <terse|caveman|reviewer|wenyan|off>]"
allowed-tools: Bash
---

If the first argument is `style`, do not change settings yet. Explain briefly:

```text
/tokenless style is reserved for future output style profiles.
Planned styles: terse, caveman, reviewer, wenyan, off.
It does not change Tokenless compression behavior yet.
```

Otherwise, show a compact Tokenless dashboard.

This repository template assumes `tokenless` is available on PATH. The installer writes a user-level command with an absolute local CLI path.

Run:

```bash
tokenless status --user
tokenless stats --data-dir ~/.tokenless
tokenless latest --data-dir ~/.tokenless
```

Then answer compactly:

```text
Tokenless:
- hooks: installed|not installed
- mode: on|off and source
- local_saved: <tokens_saved> tokens
- local_ratio: <compression_ratio>
- sources: hook=<saved>, eval=<saved>, smoke=<saved>
- read/edit/write packets: <counts and saved tokens>
- gates: pending=<n>
- latest: <artifact_id or none>
- expand: <exact expand command if latest exists>
```

Do not expand raw artifacts unless the user asks for details.
