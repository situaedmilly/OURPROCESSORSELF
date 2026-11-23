# Vendored DATASELF Contracts

These schema documents are vendored unchanged from the canonical DATASELF authority repository.

| Contract | Canonical source | Source Git blob |
| --- | --- | --- |
| OURDATA envelope v1 | `situaedmilly/OURSELF-DATABASE-ESTATE:main/SCHEMAS/ourdata-envelope.v1.schema.json` | `96ca17c4d81e8b292f3f64a09ebe9de1bbefc257` |
| OURDATA transition event v1 | `situaedmilly/OURSELF-DATABASE-ESTATE:main/SCHEMAS/ourdata-transition.v1.schema.json` | `ac322aaa81ebf800e5376e944ec7244f51ee57fa` |

The local validator supports the JSON Schema keywords used by these vendored documents and the REVERSELF profile schema. It rejects unsupported schema keywords rather than silently skipping them.

The REVERSELF continuity-profile schema is a processor-local contract. It is not represented as a canonical DATASELF schema.

Structural validity does not establish byte integrity, authority, admission, custody independence, witness independence, or runtime effects. Those remain separate verification boundaries.
