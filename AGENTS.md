# Architecture rules

- Synchronize existing commercial cards through scoped, batched reads after local actions and periodic visible-page checks; merge persisted rows into both board and open-card state so trigger-generated timestamps and externally changed proposal statuses stay consistent without relying on Realtime publication.