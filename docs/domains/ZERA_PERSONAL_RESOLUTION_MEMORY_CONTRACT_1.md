# Zera Personal Resolution Memory Contract 1

`personal-resolution-memory-v1` is an owner-scoped private write model. It stores a target reference, never AI-authored nutrients or raw input, alongside evidence and append-only transitions. P0 is logged/weak use; P1 is deliberate candidate selection; P2 is explicit confirmation, correction, deliberate personal meal save, or manual definition. Repetition is retained as P0 evidence and has no invented threshold.

Corrections write P2, supersede or contradict the preceding private scope, and record private `user_correction` negative evidence. These records are isolated by owner/RLS and cascade with the account. They are distinct from resolver observations (audit observations), aliases (input matching), portion hints, journal facts, and global knowledge candidates.

This task exposes no resolver read port, cache, ranking change, AI avoidance, view, aggregation, or global candidate. Persistence errors must be handled by integration callers after journal success without changing the journal result. V3-018 owns dependency invalidation; V3-019 owns deterministic resolver reads.
