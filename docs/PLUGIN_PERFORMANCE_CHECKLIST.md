# Plugin Performance Checklist

This checklist applies to any plugin contribution that touches hot paths or high-frequency updates.

## Hot Path Contributions

### Tool Renderers (chat streaming)

- [ ] **No synchronous work in render**: Does the renderer avoid blocking the render thread?
- [ ] **Memoization**: Is the renderer component `React.memo`-wrapped with stable comparison?
- [ ] **No store subscriptions in renderer**: Does the renderer avoid subscribing to broad stores?
- [ ] **Lookup is O(1)**: Does the tool renderer registry use Map-based lookup, not array scan?
- [ ] **No new references on every event**: Does the renderer not create new objects/arrays on every streaming update?

### UI Fills/Surfaces

- [ ] **Lazy loading**: Are heavy components loaded via `React.lazy()`?
- [ ] **No broad store subscriptions**: Does the surface subscribe only to the data it needs?
- [ ] **Stable callbacks**: Are event handlers wrapped in `useCallback` or stable refs?
- [ ] **No layout thrashing**: Does the surface avoid synchronous DOM reads/writes in effects?

### Server Routes/Middleware

- [ ] **Phase correctness**: Is the route registered in the earliest correct phase?
- [ ] **No blocking middleware**: Does middleware call `next()` promptly without blocking I/O?
- [ ] **Response size limits**: Are large responses capped or paginated?
- [ ] **No synchronous fs**: Does the route use async file operations?

## Store Discipline

- [ ] **Narrow selectors**: Do plugin components use leaf selectors, not container selectors?
- [ ] **No high-frequency state in shared stores**: Is streaming state isolated to narrow stores?
- [ ] **Reference stability**: Do plugin store updates preserve unchanged references?
- [ ] **Cross-store reads use `.getState()`**: Does the plugin use imperative reads for other stores?

## SSE/Event Pipeline

- [ ] **Gate expensive operations**: Is there a cheap boolean check before any iteration/filter?
- [ ] **Skip no-op updates**: Does the plugin return `false` from reducers when state hasn't changed?
- [ ] **Coalesce by key**: Do same-entity events replace earlier ones, not accumulate?
- [ ] **No widening fallbacks**: Does fallback logic inspect only the current entity, not arbitrary history?

## Polling

- [ ] **Two-phase polling**: Does the plugin run cheap change detection before heavy fetches?
- [ ] **Payload fidelity**: Does polling not erase rich fields with lightweight responses?
- [ ] **TTL caching**: Are repeated fetches deduplicated with a TTL window?

## Testing

- [ ] **Streaming test**: Has the contribution been tested under repeated rapid updates (60/sec)?
- [ ] **Memory test**: Has the contribution been checked for memory leaks (caches, subscriptions, timers)?
- [ ] **Render count test**: Has the contribution been verified not to cause render cascades?
