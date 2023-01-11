import React, { PropsWithChildren, useEffect } from 'react';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import ReducerRegistry from '@redhat-cloud-services/frontend-components-utilities/ReducerRegistry';
import useChrome from '@redhat-cloud-services/frontend-components/useChrome';
import { IntlProvider } from 'react-intl';

import RootApp from '../../../src/components/RootApp/RootApp';
import chromeReducer, { chromeInitialState } from '../../../src/redux';

import testUser from '../../fixtures/testUser.json';
import { Button } from '@patternfly/react-core';
import LibtJWTContext from '../../../src/components/LibJWTContext';
import { ChromeUser } from '@redhat-cloud-services/types';
import { LibJWT } from '../../../src/auth';

const Wrapper = ({ store }: {store: Store}) => (
  <IntlProvider locale="en">
    <LibtJWTContext.Provider
      value={{
        initPromise: Promise.resolve(),
        jwt: {
          getUserInfo: () => Promise.resolve(testUser as unknown as ChromeUser),
          getEncodedToken: () => '',
        } as unknown as LibJWT,
      }}
    >
      <Provider store={store}>
        <RootApp config={{
          TestApp: {
            name: 'TestApp',
            appId: 'TestApp',
            manifestLocation: '/foo/bar.json',          
          }
        }} />
      </Provider>
    </LibtJWTContext.Provider>
  </IntlProvider>
)

const TestComponent = () => {
  const chrome = useChrome();
  useEffect(() => {
    chrome.helpTopics.enableTopics('create-app-config', 'create-environment');
  }, []);
  return (
    <div>
      <Button id="open-one" variant="link" onClick={() => chrome.helpTopics.setActiveTopic('create-app-config')}>
        Open a topic create-app-config
      </Button>
      <Button id="open-two" variant="link" onClick={() => chrome.helpTopics.setActiveTopic('create-environment')}>
        Open a topic create-environment
      </Button>
    </div>
  )
}

describe('HelpTopicManager', () => {
  let store;
  beforeEach(() => {
    const reduxRegistry = new ReducerRegistry({
      ...chromeInitialState,
      chrome: {
        modules: {},
        ...chromeInitialState.chrome,
        moduleRoutes: [
          {
            path: "/__cypress/iframes//home/martin/insights/insights-chrome/cypress/component/helptopics/HelpTopicManager.cy.tsx",
            module: './TestApp',
            scope: 'TestApp',
            appId: 'TestApp',
            manifestLocation: '/foo/bar.json',

          }
        ],
        user: testUser  ,
      },
    });
    reduxRegistry.register(chromeReducer());
    store = reduxRegistry.getStore();
    cy.intercept('GET', '/api/featureflags/*', {
      toggles: [],
    });
    cy.intercept('GET', '/foo/bar.json', {
      entries: [],
    }).as('manifest');
    cy.intercept('POST', '/api/featureflags/v0/client/metrics', {});
    cy.intercept('POST', 'https://api.segment.io/v1/*', {});
    cy.intercept('GET', ' /api/rbac/v1/access/?application=inventory&limit=1000', {
      data: []
    });
    cy.intercept('GET', '/api/quickstarts/v1/progress?account=*', {
      data: []
    });
    cy.intercept('GET', '/api/quickstarts/v1/*', (req) => {      
      if (req.url.includes('/helptopics')) {
        req.reply({status: 200, fixture: 'helpTopicsResponse.json'})
        return
      }

      req.reply({status: 200, body: {data: []}})
    })

  })

  it('should switch help topics drawer content', () => {
    // change screen size
    cy.viewport(1280, 720);
    // mount element
    cy.mount(<Wrapper store={store}></Wrapper>)
    cy.wait('@manifest')

    // mock the dynamic module
    cy.window().then(win => {
      win.TestApp = {
        init: () => {

        },
        get: () => () => ({
          default: TestComponent
        })
      }
      win.__scalprum__ = {
        ...window.__scalprum__,
        scalprumOptions: {
          cacheTimeout: 999999,
        },
        factories: {
          TestApp: {
            expiration: new Date('01-01-3000'),
            modules: {
              './TestApp': {
                __esModule: true,
                default: TestComponent
              }
            }
          }
        }
      }
    })

    // open drawer
    cy.get("#open-one").click()
    cy.get(`h1.pf-c-title`).should('be.visible').contains('Configure components')
    // switch from external button
    cy.get("#open-two").click()
    cy.get(`h1.pf-c-title`).should('be.visible').contains('Create a new environment')

    // open help topics context menu
    cy.get("button#helptopics-toggle").click()
    cy.get("button.pf-c-options-menu__menu-item").contains('Automatic Deployment').click()
    cy.get(`h1.pf-c-title`).should('be.visible').contains('Automatic Deployment')

    // switch from external button back to first topic
    cy.get("#open-one").click()
    cy.get(`h1.pf-c-title`).should('be.visible').contains('Configure components')

    // close drawer
    cy.get('div.pfext-quick-start-panel-content__close-button').click()
    cy.get(`h1.pf-c-title`).contains('Configure components').should('not.exist')

    // open second help topic
    cy.get("#open-two").click()
    cy.get(`h1.pf-c-title`).should('be.visible').contains('Create a new environment')

  });
});
