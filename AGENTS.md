# Architecture rules

- Synchronize existing commercial cards through scoped, batched reads after local actions and periodic visible-page checks; merge persisted rows into both board and open-card state so trigger-generated timestamps and externally changed proposal statuses stay consistent without relying on Realtime publication.
- Client registration uses a per-lead token, an atomic completion RPC and linked stores; retain a submitted-data snapshot for the registration tab while preserving contract-compatible lead fields, so completion never creates or moves commercial cards.