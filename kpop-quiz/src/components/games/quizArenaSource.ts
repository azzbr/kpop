// Lets another screen (Quiz Maker's "Play") open Quiz Arena on a chosen question source.
let pending: string | null = null;
export const setArenaSource = (id: string) => { pending = id; };
export const takeArenaSource = () => { const id = pending; pending = null; return id; };
