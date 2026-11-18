import './polyfills';
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// Web: phone-width column on wide screens (must run before any screen loads).
if (Platform.OS === 'web') require('./web/setupWeb');

// Release builds: drop verbose logging. The app has hundreds of console.log
// calls (many serialising whole query results); on a real device every one
// costs JS-thread time. Warnings and errors are kept.
if (!__DEV__) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}

// Release builds: keep the app alive through stray errors.
// Render errors are already contained per screen (ScreenBoundary); this covers
// errors thrown from button handlers, timers and promises' sync callbacks —
// which React Native would otherwise treat as fatal and close the app.
// Errors before the app has mounted still go to the default handler, so a
// genuine start-up failure is reported instead of leaving a blank screen.
if (!__DEV__ && global.ErrorUtils) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler();
  let lastToast = 0;
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('[GlobalError]', isFatal ? 'fatal' : 'non-fatal', error?.message || error);
    if (!global.__SEMPAI_APP_READY) {
      defaultHandler?.(error, isFatal);
      return;
    }
    if (Date.now() - lastToast > 4000) {
      lastToast = Date.now();
      try {
        require('./components/Toast').toast.error('Something went wrong — please try that again.');
      } catch {
        /* toast unavailable */
      }
    }
  });
}

// Required after the logging guard so module-level logs are covered too.
const App = require('./App').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
