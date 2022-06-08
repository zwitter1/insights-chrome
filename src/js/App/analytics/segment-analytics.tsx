import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AnalyticsBrowser } from '@segment/analytics-next';
import { isProd } from '../../utils';

type SegmentEnvs = 'dev' | 'prod';
type SegmentModules = 'openshift';

const KEY_FALLBACK = {
  prod: 'nm7VsnYsBVJ9MqjaVInft69pAkhCXq9Q',
  dev: 'Aoak9IFNixtkZJRatfZG9cY1RHxbATW1',
};

const getAPIKey = (env: SegmentEnvs = 'dev', module: SegmentModules) =>
  ({
    prod: {
      openshift: 'z3Ic4EtzJtHrhXfpKgViJmf2QurSxXb9',
    },
    dev: {
      openshift: 'A8iCO9n9Ax9ObvHBgz4hMC9htKB0AdKj',
    },
  }[env]?.[module] || KEY_FALLBACK[env]);

const registerUrlObserver = () => {
  /**
   * We ignore hash changes
   * Hashes only have frontend effect
   */
  let oldHref = document.location.href.replace(/#.*$/, '');

  window.onload = function () {
    const bodyList = document.body;
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function () {
        const newLocation = document.location.href.replace(/#.*$/, '');
        if (oldHref !== newLocation) {
          oldHref = newLocation;
          setTimeout(() => {
            window.segment?.page();
          });
        }
      });
    });
    const config = {
      childList: true,
      subtree: true,
    };
    observer.observe(bodyList, config);
  };
};

export const SegmentContext = createContext<{ ready: boolean; analytics?: AnalyticsBrowser }>({
  ready: false,
  analytics: undefined,
});

export type SegmentProviderProps = {
  activeModule: string;
};

export const SegmentProvider: React.FC<SegmentProviderProps> = ({ activeModule, children }) => {
  const analytics = useRef<AnalyticsBrowser>();
  useEffect(() => {
    registerUrlObserver();
  }, []);

  useEffect(() => {
    if (activeModule) {
      const newKey = getAPIKey(isProd() ? 'prod' : 'dev', activeModule as SegmentModules);
      if (!analytics.current) {
        analytics.current = AnalyticsBrowser.load({ writeKey: newKey }, { initialPageview: true });
        window.segment = analytics.current;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore TS does not allow accessing the instance settings but its necessary for us to not create instances if we don't have to
      } else if (analytics.current?.instance?.settings.writeKey !== newKey) {
        window.segment = undefined;
        analytics.current = AnalyticsBrowser.load({ writeKey: newKey }, { initialPageview: false });
        window.segment = analytics.current;
      }
    }
  }, [activeModule]);

  return (
    <SegmentContext.Provider
      value={{
        ready: true,
        analytics: analytics.current,
      }}
    >
      {children}
    </SegmentContext.Provider>
  );
};

export function useSegment() {
  const ctx = useContext(SegmentContext);
  if (!ctx) {
    throw new Error('Context used outside of its Provider!');
  }
  return ctx;
}
