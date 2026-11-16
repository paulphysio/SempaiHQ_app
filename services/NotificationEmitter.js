/**
 * Tiny in-app event bus for "a notification just arrived".
 *
 * (This used to be a NativeEventEmitter with no native module behind it, and
 * App.js emitted with no event name, so listeners never fired — the unread
 * badge only updated after an app reload.)
 *
 *   NotificationEmitter.emit();                       // defaults to 'notificationReceived'
 *   const sub = NotificationEmitter.addListener('notificationReceived', fn);
 *   sub.remove();
 */
const listeners = new Map();

export const NotificationEmitter = {
  emit(event = 'notificationReceived', payload) {
    (listeners.get(event) || []).slice().forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.warn('[NotificationEmitter] listener failed:', e?.message || e);
      }
    });
  },
  addListener(event, fn) {
    const list = listeners.get(event) || [];
    list.push(fn);
    listeners.set(event, list);
    return {
      remove() {
        const current = listeners.get(event) || [];
        listeners.set(event, current.filter((f) => f !== fn));
      },
    };
  },
};
