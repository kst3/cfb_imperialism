/* Pure game state and geometry, shared by the UI and browser tests. */
(function (root) {
  'use strict';
  function fresh(teams, neutralIds = []) { return { version: 1, owners: Object.fromEntries([...teams.map(t => [t.id, t.id]), ...neutralIds.map(id => [id, null])]), history: [] }; }
  function survivors(state) { return [...new Set(Object.values(state.owners).filter(Boolean))]; }
  function claim(state, winner, territory) {
    if (!survivors(state).includes(winner) || !Object.hasOwn(state.owners, territory) || state.owners[territory] !== null) throw new Error('Only unclaimed land can be claimed.');
    state.owners[territory] = winner;
    state.history.push({ winner, loser: null, captured: [territory] });
  }
  function resolve(state, winner, loser) {
    const alive = survivors(state);
    if (winner === loser || !alive.includes(winner) || !alive.includes(loser)) throw new Error('Both opponents must be distinct surviving teams.');
    const captured = Object.keys(state.owners).filter(id => state.owners[id] === loser);
    captured.forEach(id => { state.owners[id] = winner; });
    state.history.push({ winner, loser, captured });
  }
  function undo(state) {
    const last = state.history.pop();
    if (last) last.captured.forEach(id => { state.owners[id] = last.loser; });
    return last;
  }
  function valid(saved, teams, neutralIds = []) {
    if (!saved || saved.version !== 1 || !Array.isArray(saved.history) || saved.history.length >= teams.length + neutralIds.length) return false;
    try {
      const replay = fresh(teams, neutralIds);
      for (const entry of saved.history) {
        if (entry.loser === null) claim(replay, entry.winner, entry.captured[0]);
        else resolve(replay, entry.winner, entry.loser);
        if (JSON.stringify(replay.history.at(-1).captured) !== JSON.stringify(entry.captured)) return false;
      }
      return Object.keys(saved.owners).length === Object.keys(replay.owners).length && Object.keys(replay.owners).every(id => replay.owners[id] === saved.owners[id]);
    } catch { return false; }
  }
  function loadCampaign(saved, teams, neutralIds) {
    if (valid(saved,teams,neutralIds)) return saved;
    // Replay older campaigns without Alaska, retaining every other result.
    const legacyIds = Object.keys(saved?.owners || {}).filter(id => !teams.some(t => t.id === id));
    if (legacyIds.some(id => id !== 'state:AK' && !neutralIds.includes(id)) || !valid(saved,teams,legacyIds)) return null;
    const migrated = fresh(teams,neutralIds);
    for (const entry of saved.history) {
      if (entry.loser !== null) resolve(migrated,entry.winner,entry.loser);
      else if (entry.captured[0] !== 'state:AK') claim(migrated,entry.winner,entry.captured[0]);
    }
    return migrated;
  }
  function inside(point, polygon) {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
    }
    return result;
  }
  function inRings(point, rings) { return rings.reduce((yes, ring) => inside(point, ring) ? !yes : yes, false); }
  function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
  function raySegment(origin, direction, a, b) {
    const edge = [b[0] - a[0], b[1] - a[1]], offset = [a[0] - origin[0], a[1] - origin[1]];
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) < 1e-10) return null;
    const t = cross(offset, edge) / denominator, u = cross(offset, direction) / denominator;
    return t >= 0 && u >= -1e-9 && u <= 1 + 1e-9 ? t : null;
  }
  // Partition a ray at every state/cell edge, then test interval midpoints.
  // This finds narrow territories without raster sampling or skipping islands.
  function firstHit(origin, angle, attacker, cells, owners) {
    const direction = [Math.cos(angle), Math.sin(angle)];
    let best = null;
    for (const cell of cells) {
      const owner = owners[cell.id];
      if (owner === attacker) continue;
      const cuts = [0];
      for (const ring of [cell.polygon, ...cell.rings]) {
        for (let i = 0; i < ring.length; i++) {
          const t = raySegment(origin, direction, ring[i], ring[(i + 1) % ring.length]);
          if (t !== null) cuts.push(t);
        }
      }
      cuts.sort((a,b) => a-b);
      for (let i = 0; i < cuts.length - 1; i++) {
        if (cuts[i + 1] - cuts[i] < 1e-8 || (best && cuts[i] >= best.distance)) continue;
        const distance = (cuts[i] + cuts[i + 1]) / 2;
        const point = [origin[0] + direction[0] * distance, origin[1] + direction[1] * distance];
        if (inside(point, cell.polygon) && inRings(point, cell.rings)) {
          best = { id: owner, territory: cell.id, distance: cuts[i], point: [origin[0] + direction[0] * cuts[i], origin[1] + direction[1] * cuts[i]] };
          break;
        }
      }
    }
    return best;
  }
  root.Empire = { fresh, survivors, claim, resolve, undo, valid, loadCampaign, inside, inRings, raySegment, firstHit };
})(globalThis);
