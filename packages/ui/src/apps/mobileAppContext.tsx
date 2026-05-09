/* eslint-disable react-refresh/only-export-components */
import React from 'react';

const DedicatedMobileAppContext = React.createContext<boolean>(false);

export const DedicatedMobileAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DedicatedMobileAppContext.Provider value={true}>{children}</DedicatedMobileAppContext.Provider>
);

/**
 * Returns true when the surrounding tree is the dedicated MobileApp root
 * (Capacitor or hosted /mobile.html), as opposed to the desktop responsive
 * mobile path. Use this to suppress UI that exists only to bridge the
 * desktop sidebar/layout into mobile, since the dedicated mobile root has
 * its own native-feeling navigation and no sidebars to bridge into.
 */
export const useIsDedicatedMobileApp = (): boolean => React.useContext(DedicatedMobileAppContext);
