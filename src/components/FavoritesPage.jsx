/**
 * Teams Prompt Library - Favorites Page
 * Adapted from SPARK AI for Teams integration with cloud-based favorites
 */

import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
  Title1,
  Title2,
  Title3,
  Body1,
  Body2,
  Button,
  Badge,
  Spinner,
} from '@fluentui/react-components';
import {
  Heart24Filled,
  Image24Regular,
} from '@fluentui/react-icons';
import { glass } from '../ui/themeGlass';
import { AppContext } from '../App';
import { getAccessToken } from '../utils/teamsAuth';

const useStyles = makeStyles({
  container: {
    minHeight: '100vh',
    ...shorthands.padding('20px'),
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '40px',
    fontWeight: 600,
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
  },
  subtitle: {
    fontSize: '16px',
    color: tokens.colorNeutralForeground2,
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    ...shorthands.gap('16px'),
    marginBottom: '32px',
  },
  promptCard: {
    height: '100%',
    cursor: 'pointer',
    ...glass.card,
    ...shorthands.borderRadius('8px'),
  },
  promptCardDark: {
    ...glass.cardDark,
  },
  promptIcon: {
    fontSize: '32px',
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    ...shorthands.gap('8px'),
    marginTop: '8px',
  },
  emptyState: {
    textAlign: 'center',
    ...shorthands.padding('64px', '24px'),
    ...glass.card,
    ...shorthands.borderRadius('8px'),
  },
  emptyStateDark: {
    ...glass.cardDark,
  },
  emptyIcon: {
    fontSize: '72px',
    marginBottom: '20px',
  },
});

export default function FavoritesPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { theme } = useContext(AppContext);
  const isDark = theme === 'dark' || theme === 'contrast';

  const [favoritePrompts, setFavoritePrompts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const token = await getAccessToken();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

      const response = await fetch(`${apiUrl}/favorites`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load favorites');

      const data = await response.json();
      setFavoritePrompts(data.favorites || []);
    } catch (error) {
      console.error('Failed to load favorites:', error);
      setFavoritePrompts([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePromptClick = (promptId) => {
    navigate(`/view/${promptId}`);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Spinner size="huge" label="Loading favorites..." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <Heart24Filled style={{ color: tokens.colorPaletteRedForeground1 }} />
          Favorites
        </div>
        <div className={styles.subtitle}>
          {favoritePrompts.length === 0
            ? "You haven't added any prompts to your favorites yet."
            : `${favoritePrompts.length} saved ${favoritePrompts.length === 1 ? 'prompt' : 'prompts'}`
          }
        </div>
      </div>

      {favoritePrompts.length === 0 ? (
        <div className={mergeClasses(styles.emptyState, isDark && styles.emptyStateDark)}>
          <div className={styles.emptyIcon}>❤️</div>
          <Title2 block style={{ marginBottom: '8px' }}>No favorites yet</Title2>
          <Body1 style={{ marginBottom: '24px', color: tokens.colorNeutralForeground2 }}>
            Browse prompts and click the heart icon to add them to your favorites.
          </Body1>
          <Button
            appearance="primary"
            size="large"
            onClick={() => navigate('/browse')}
          >
            Browse Prompts
          </Button>
        </div>
      ) : (
        <div className={styles.gridContainer}>
          {favoritePrompts.map((favorite) => {
            const prompt = favorite.prompt || favorite;
            return (
              <div
                key={prompt.id}
                className={mergeClasses(styles.promptCard, isDark && styles.promptCardDark)}
                onClick={() => handlePromptClick(prompt.id)}
              >
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: '12px', marginBottom: '12px' }}>
                    <span className={styles.promptIcon}>{prompt.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Title3 block style={{ marginBottom: '8px' }}>
                        {prompt.title}
                      </Title3>
                      <Badge appearance="filled" color="brand">
                        {prompt.department}
                      </Badge>
                    </div>
                  </div>

                  <Body2 block style={{ marginBottom: '12px', color: tokens.colorNeutralForeground2 }}>
                    {prompt.description && prompt.description.length > 120
                      ? `${prompt.description.substring(0, 120)}...`
                      : prompt.description
                    }
                  </Body2>

                  {prompt.tags && prompt.tags.length > 0 && (
                    <div className={styles.tagsContainer}>
                      {prompt.tags.slice(0, 3).map((tag, idx) => (
                        <Badge key={idx} appearance="outline" size="small">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: `1px solid ${tokens.colorNeutralStroke2}`
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      color: tokens.colorNeutralForeground2
                    }}>
                      {prompt.images && prompt.images.length > 0 && <Image24Regular />}
                      <span>{prompt.word_count} words</span>
                    </div>
                    <Heart24Filled style={{ color: tokens.colorPaletteRedForeground1 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
