// Web: show the PDF with the browser's own viewer.
import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { View } from 'react-native';

// `page` opens the browser viewer at that page (#page=N). The browser doesn't
// report page turns back, so web readers don't save PDF positions.
const Pdf = forwardRef(({ source, style, onLoadComplete, page }, ref) => {
  const base = source?.uri || '';
  const uri = base && page > 1 ? `${base.split('#')[0]}#page=${page}` : base;
  useImperativeHandle(ref, () => ({ setPage: () => {} }), []);
  useEffect(() => { if (uri && onLoadComplete) onLoadComplete(1, uri); }, [uri]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={[{ flex: 1 }, style]}>
      {React.createElement('iframe', {
        src: uri, title: 'PDF', style: { border: 0, width: '100%', height: '100%', flex: 1 },
      })}
    </View>
  );
});
export default Pdf;
