// Which chat is on screen right now ('group', a user id, or null) — so a push for that same chat
// doesn't pop a banner over the conversation you're already reading.
let current = null;
export const setActiveChat = (id) => { current = id || null; };
export const getActiveChat = () => current;
