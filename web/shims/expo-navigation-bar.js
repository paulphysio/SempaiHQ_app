// Web: there is no Android navigation bar — no-ops.
const done = async () => {};
export const setVisibilityAsync = done;
export const setBackgroundColorAsync = done;
export const setButtonStyleAsync = done;
export const setBehaviorAsync = done;
export const setPositionAsync = done;
export const setBorderColorAsync = done;
export const getVisibilityAsync = async () => 'visible';
export const addVisibilityListener = () => ({ remove() {} });
