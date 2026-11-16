import { StackActions } from '@react-navigation/native';

/**
 * Navigate to a top-level destination (sidebar / bottom-nav entries).
 *
 * React Navigation 7's `navigate` always pushes a new copy of a screen, so
 * hopping between Swap, Leaderboard, Home… from the global nav kept stacking
 * fresh instances of heavy screens — each one refetching its data and staying
 * mounted. Here we return to the existing instance when there is one, and
 * only push when the destination isn't in the stack yet.
 */
export const goToTopLevel = (navigation, name, params) => {
  const state = navigation?.getState?.();
  const routes = state?.routes || [];
  const current = routes[state?.index ?? routes.length - 1];

  if (current?.name === name) return;

  if (routes.some((r) => r.name === name)) {
    navigation.dispatch(StackActions.popTo(name, params));
  } else {
    navigation.navigate(name, params);
  }
};

/** Name of the deepest focused route in a navigation state tree. */
export const getActiveRouteName = (state) => {
  let s = state;
  while (s?.routes?.[s.index ?? 0]?.state) s = s.routes[s.index ?? 0].state;
  return s?.routes?.[s.index ?? 0]?.name;
};
