# Tokenless packet format

All compressed outputs from Tokenless use the `TOKENLESS-PACKET/0.1` prefix.

```
TOKENLESS-PACKET/0.1

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
tokenless show <artifact_id>
```
