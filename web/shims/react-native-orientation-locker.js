// Web: browsers decide orientation themselves — these are no-ops.
const noop = () => {};
const Orientation = {
  lockToPortrait: noop, lockToLandscape: noop, lockToLandscapeLeft: noop, lockToLandscapeRight: noop,
  unlockAllOrientations: noop, addOrientationListener: noop, removeOrientationListener: noop,
  getOrientation: (cb) => cb && cb('PORTRAIT'), getInitialOrientation: () => 'PORTRAIT',
};
export default Orientation;
export const OrientationLocker = () => null;
