# GITHUBCOMPUTERMORPH v0.1 Pressure Test

Result: **PASS**

Local witness: 10 tests, 10 passed, 0 failed.

| Boundary | Result |
|---|---|
| Unknown surface | REJECT |
| Missing admission | REJECT |
| Unauthorized transition | REJECT |
| Unbounded transition | REJECT |
| Valid CPU transition | ADMIT + SHA-256 receipt |
| Cache hit | Does not grant authority |
| Purge without admission | REJECT |
| Purge with admission | BOUNDED PLAN |
| Raw Git ref movement | Not a computational transition |
| Receipt/state binding | PASS |

## Constitutional conclusion

A Git ref movement without a repository-machine proposal, admission, and receipt is not a computational transition under GITHUBCOMPUTERMORPH v0.1.

No external automation was used or introduced.
