/**
 * Teams Prompt Library - Main App Component
 * Root component with routing, authentication, and Teams integration
 */

import React, { useState, useEffect, createContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  makeStyles,
  Spinner,
  Text,
  Button
} from '@fluentui/react-components';
import { initializeAuth, isSignedIn, signIn, getCurrentAccount } from './utils/teamsAuth';
import { getTeamsContext } from './utils/teamsSDK';

// Create context for app-wide state
export const AppContext = createContext(null);

// Import real components
import BrowsePage from './components/BrowsePage';
import ViewPage from './components/ViewPage';
import FavoritesPage from './components/FavoritesPage';

// Styles
const useStyles = makeStyles({
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    width: '100%'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    gap: '16px'
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    gap: '16px',
    padding: '20px'
  },
  content: {
    flex: 1,
    width: '100%',
    overflowY: 'auto'
  }
});

/**
 * Main App Component
 */
function App({ teamsContext: initialTeamsContext, isInTeams, initialTheme }) {
  const styles = useStyles();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userAccount, setUserAccount] = useState(null);
  const [teamsContext, setTeamsContext] = useState(initialTeamsContext);

  /**
   * Initialize app on mount
   */
  useEffect(() => {
    async function initialize() {
      try {
        setIsLoading(true);

        // Initialize authentication
        await initializeAuth();

        // Check if user is signed in
        const signedIn = isSignedIn();
        setIsAuthenticated(signedIn);

        if (signedIn) {
          const account = getCurrentAccount();
          setUserAccount(account);
          console.log('✅ User authenticated:', account?.username);
        }

        // Get Teams context if in Teams and not already provided
        if (isInTeams && !initialTeamsContext) {
          const context = await getTeamsContext();
          setTeamsContext(context);
          console.log('✅ Teams context loaded:', context);
        }

        setIsLoading(false);

      } catch (err) {
        console.error('❌ App initialization failed:', err);
        setError(err.message || 'Failed to initialize app');
        setIsLoading(false);
      }
    }

    initialize();
  }, [isInTeams, initialTeamsContext]);

  /**
   * Handle sign in
   */
  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      await signIn();

      const account = getCurrentAccount();
      setUserAccount(account);
      setIsAuthenticated(true);

      console.log('✅ Sign in successful');

    } catch (err) {
      console.error('❌ Sign in failed:', err);
      setError('Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Loading state
   */
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size="extra-large" label="Initializing Teams Prompt Library..." />
        <Text>Setting up authentication and loading your workspace...</Text>
      </div>
    );
  }

  /**
   * Error state
   */
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <Text as="h2" size={700}>⚠️ Initialization Error</Text>
        <Text>{error}</Text>
        <Button appearance="primary" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  /**
   * Not authenticated state
   */
  if (!isAuthenticated) {
    return (
      <div className={styles.loadingContainer}>
        <Text as="h2" size={700}>🔐 Sign In Required</Text>
        <Text>Please sign in to access the Teams Prompt Library</Text>
        <Button appearance="primary" size="large" onClick={handleSignIn}>
          Sign In with Microsoft
        </Button>
      </div>
    );
  }

  /**
   * Main app (authenticated)
   */
  return (
    <AppContext.Provider
      value={{
        isInTeams,
        teamsContext,
        userAccount,
        isAuthenticated,
        theme: initialTheme
      }}
    >
      <BrowserRouter>
        <div className={styles.appContainer}>
          <div className={styles.content}>
            <Routes>
              <Route path="/" element={<Navigate to="/browse" replace />} />
              <Route path="/browse" element={<BrowsePage />} />
              <Route path="/view/:id" element={<ViewPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="*" element={<Navigate to="/browse" replace />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AppContext.Provider>
  );
}

export default App;
