# Compact output format

All compressed outputs from ACC use `ACC-COMPACTED/0.1` prefix.

```
ACC-COMPACTED/0.1

Tool: Bash
Command: <original command>
Status: failed|success
Original exit code: <code>
Reducer: <reducer>
Compression: <before> -> <after> estimated tokens

Key findings:
- ...

Dropped:
- ...

Raw artifact:
acc show <artifact_id>
```
