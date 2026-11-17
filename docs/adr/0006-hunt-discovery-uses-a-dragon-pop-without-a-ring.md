# ADR 0006 — The hunt discovery uses a dragon pop without an expanding ring

**Status:** Accepted · 2026-11-17

## Context

The hunt introduction reveals its clickable dragon with a squash-and-bounce pop. An expanding
circular outline played behind the dragon at the same time. The extra shape looked like part of
the dragon or an unintended click indicator instead of supporting the reveal.

## Decision

`easter-hunt/hunt.css` keeps the dragon's `hunt-clue-pop` animation and removes the expanding
ring pseudo-element and its animation.

## Consequences

- The dragon still grows, overshoots and settles when it appears.
- No circle appears behind it during the reveal.
- The keyboard focus indicator remains unchanged and still appears for keyboard navigation.

## Alternatives considered

- **Make the ring subtler.** Rejected because it would still add a second visual event to a reveal
  that reads clearly with the dragon pop alone.
- **Remove the pop too.** Rejected because the pop directs attention to the newly clickable dragon.
