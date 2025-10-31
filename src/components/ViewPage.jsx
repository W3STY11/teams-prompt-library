/**
 * Teams Prompt Library - View Prompt Page
 * Adapted from SPARK AI for Teams integration
 */

import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Toast,
  Toaster,
  useToastController,
  useId,
} from '@fluentui/react-components';
import {
  Copy24Regular,
  Checkmark24Filled,
  ArrowLeft24Regular,
  Heart24Regular,
  Heart24Filled,
  Share24Regular,
} from '@fluentui/react-icons';
import { glass } from '../ui/themeGlass';
import { AppContext } from '../App';
import { getAccessToken } from '../utils/teamsAuth';
import { sharePromptToTeams } from '../utils/teamsSDK';

const useStyles = makeStyles({
  container: {
    minHeight: '100vh',
    ...shorthands.padding('20px'),
  },
  hero: {
    marginBottom: '32px',
  },
  heroHeader: {
    display: 'flex',
    alignItems: 'start',
    ...shorthands.gap('16px'),
    marginBottom: '16px',
  },
  heroIcon: {
    fontSize: '48px',
  },
  heroContent: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    fontSize: '32px',
    fontWeight: 600,
    lineHeight: '40px',
    marginBottom: '12px',
  },
  heroMeta: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
    flexWrap: 'wrap',
  },
  promptCard: {
    ...glass.card,
    ...shorthands.padding('20px'),
    ...shorthands.borderRadius('8px'),
    marginBottom: '16px',
  },
  promptCardDark: {
    ...glass.cardDark,
  },
  promptText: {
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: '14px',
    lineHeight: '24px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    ...shorthands.padding('16px'),
    background: isDark => isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)',
    ...shorthands.borderRadius('8px'),
    maxHeight: '500px',
    overflowY: 'auto',
  },
  buttonGroup: {
    display: 'flex',
    ...shorthands.gap('8px'),
    marginTop: '16px',
    flexWrap: 'wrap',
  },
  sidebarCard: {
    ...glass.card,
    ...shorthands.padding('16px'),
    ...shorthands.borderRadius('8px'),
    marginBottom: '16px',
  },
  sidebarCardDark: {
    ...glass.cardDark,
  },
  metaItem: {
    display: 'flex',
    justifyContent: 'space-between',
    ...shorthands.padding('8px', '0'),
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
    ':last-child': {
      borderBottom: 'none',
    },
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    ...shorthands.gap('8px'),
    marginTop: '8px',
  },
  tipsSection: {
    ...glass.card,
    ...shorthands.padding('16px'),
    ...shorthands.borderRadius('8px'),
    marginBottom: '16px',
  },
  tipsSectionDark: {
    ...glass.cardDark,
  },
  tipItem: {
    marginBottom: '12px',
    paddingLeft: '24px',
    position: 'relative',
    '::before': {
      content: '"💡"',
      position: 'absolute',
      left: '0',
    },
  },
});

// Helper to highlight placeholders
const highlightPlaceholders = (text, isDark) => {
  if (!text) return null;

  const parts = [];
  let lastIndex = 0;
  const placeholderRegex = /\[([^\]]+)\]/g;
  let match;

  while ((match = placeholderRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    parts.push(
      <span
        key={match.index}
        style={{
          backgroundColor: isDark ? 'rgba(96, 94, 255, 0.2)' : 'rgba(96, 94, 255, 0.15)',
          color: isDark ? '#a6a4ff' : '#6250ea',
          padding: '2px 6px',
          borderRadius: '4px',
          fontWeight: 600,
        }}
      >
        [{match[1]}]
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

export default function ViewPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { id } = useParams();
  const { theme, isInTeams } = useContext(AppContext);
  const isDark = theme === 'dark' || theme === 'contrast';

  const [prompt, setPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedType, setCopiedType] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  useEffect(() => {
    loadPrompt();
    checkFavorite();
  }, [id]);

  const loadPrompt = async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      const token = await getAccessToken();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

      const response = await fetch(`${apiUrl}/prompts/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Prompt not found');

      const data = await response.json();
      let promptData = data.prompt || data;

      // Parse additional_tips if it's a string (from SQL database)
      if (promptData && typeof promptData.additional_tips === 'string') {
        try {
          promptData.additional_tips = JSON.parse(promptData.additional_tips);
        } catch (e) {
          console.warn('Failed to parse additional_tips:', e);
          promptData.additional_tips = [];
        }
      }

      // Ensure additional_tips is an array
      if (promptData && !Array.isArray(promptData.additional_tips)) {
        promptData.additional_tips = [];
      }

      setPrompt(promptData);
    } catch (error) {
      console.error('Failed to load prompt:', error);
      dispatchToast(
        <Toast>
          <div>⚠️ Failed to load prompt</div>
        </Toast>,
        { intent: 'error' }
      );
    } finally {
      setLoading(false);
    }
  };

  const checkFavorite = async () => {
    try {
      const token = await getAccessToken();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

      const response = await fetch(`${apiUrl}/favorites`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const favorites = data.favorites || [];
        setIsFavorite(favorites.some(f => f.prompt_id === id));
      }
    } catch (error) {
      console.error('Failed to check favorites:', error);
    }
  };

  const toggleFavorite = async () => {
    try {
      const token = await getAccessToken();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

      const method = isFavorite ? 'DELETE' : 'POST';
      const response = await fetch(`${apiUrl}/favorites/${id}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIsFavorite(!isFavorite);
        dispatchToast(
          <Toast>
            <div>{isFavorite ? 'Removed from' : 'Added to'} favorites</div>
          </Toast>,
          { intent: 'success' }
        );
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      dispatchToast(
        <Toast>
          <div>Failed to update favorites</div>
        </Toast>,
        { intent: 'error' }
      );
    }
  };

  const copyToClipboard = async (type) => {
    if (!prompt?.content) return;

    try {
      await navigator.clipboard.writeText(prompt.content);

      setCopiedType(type);

      dispatchToast(
        <Toast>
          <div>✅ Copied to clipboard!</div>
        </Toast>,
        { intent: 'success' }
      );

      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      dispatchToast(
        <Toast>
          <div>Failed to copy to clipboard</div>
        </Toast>,
        { intent: 'error' }
      );
    }
  };

  const sharePrompt = async () => {
    if (isInTeams && prompt) {
      try {
        await sharePromptToTeams(prompt);
        dispatchToast(
          <Toast>
            <div>✅ Shared to Teams!</div>
          </Toast>,
          { intent: 'success' }
        );
      } catch (err) {
        console.error('Failed to share:', err);
      }
    } else {
      try {
        const url = window.location.href;
        await navigator.clipboard.writeText(url);
        dispatchToast(
          <Toast>
            <div>✅ Link copied!</div>
          </Toast>,
          { intent: 'success' }
        );
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Spinner size="huge" label="Loading prompt..." />
        </div>
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', padding: '64px 24px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔍</div>
          <Title2 block style={{ marginBottom: '8px' }}>Prompt not found</Title2>
          <Body1 style={{ marginBottom: '24px' }}>The prompt you're looking for doesn't exist.</Body1>
          <Button
            appearance="primary"
            icon={<ArrowLeft24Regular />}
            onClick={() => navigate('/browse')}
          >
            Back to Browse
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Toaster toasterId={toasterId} />

      {/* Back Button */}
      <Button
        appearance="subtle"
        icon={<ArrowLeft24Regular />}
        onClick={() => navigate('/browse')}
        style={{ marginBottom: '16px' }}
      >
        Back
      </Button>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroHeader}>
          <div className={styles.heroIcon}>{prompt.icon}</div>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>{prompt.title}</h1>
            <div className={styles.heroMeta}>
              <Badge appearance="filled" color="brand" size="large">
                {prompt.department}
              </Badge>
              {prompt.subcategory && (
                <Badge appearance="outline" size="large">
                  {prompt.subcategory}
                </Badge>
              )}
              {prompt.complexity && (
                <Badge
                  appearance="tint"
                  color={
                    prompt.complexity === 'advanced' ? 'danger' :
                    prompt.complexity === 'intermediate' ? 'warning' :
                    'success'
                  }
                  size="large"
                >
                  {prompt.complexity.charAt(0).toUpperCase() + prompt.complexity.slice(1)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {prompt.description && (
          <Body1 style={{ fontSize: '16px', lineHeight: '24px', color: tokens.colorNeutralForeground2 }}>
            {prompt.description}
          </Body1>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <Button
          appearance="subtle"
          icon={isFavorite ? <Heart24Filled /> : <Heart24Regular />}
          onClick={toggleFavorite}
        >
          {isFavorite ? 'Saved' : 'Save'}
        </Button>
        <Button
          appearance="subtle"
          icon={<Share24Regular />}
          onClick={sharePrompt}
        >
          Share
        </Button>
      </div>

      {/* The Prompt */}
      <div className={mergeClasses(styles.promptCard, isDark && styles.promptCardDark)}>
        <Title3 style={{ marginBottom: '12px' }}>📋 The Prompt</Title3>
        <div
          className={styles.promptText}
          style={{ background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)' }}
        >
          {highlightPlaceholders(prompt.content, isDark)}
        </div>

        <div className={styles.buttonGroup}>
          <Button
            appearance="primary"
            size="large"
            icon={copiedType === 'regular' ? <Checkmark24Filled /> : <Copy24Regular />}
            onClick={() => copyToClipboard('regular')}
          >
            {copiedType === 'regular' ? 'Copied!' : 'Copy Prompt'}
          </Button>
        </div>
      </div>

      {/* Tips */}
      {prompt.tips && prompt.tips.length > 0 && (
        <div className={mergeClasses(styles.tipsSection, isDark && styles.tipsSectionDark)}>
          <Title3 style={{ marginBottom: '12px' }}>💡 Tips</Title3>
          {prompt.tips.map((tip, index) => (
            <div key={index} className={styles.tipItem}>
              <Body1>{tip}</Body1>
            </div>
          ))}
        </div>
      )}

      {/* Metadata */}
      <div className={mergeClasses(styles.sidebarCard, isDark && styles.sidebarCardDark)}>
        <Title3 style={{ marginBottom: '12px' }}>Details</Title3>
        <div className={styles.metaItem}>
          <span style={{ color: tokens.colorNeutralForeground2 }}>Words</span>
          <span style={{ fontWeight: 600 }}>{prompt.word_count}</span>
        </div>
        {prompt.images && prompt.images.length > 0 && (
          <div className={styles.metaItem}>
            <span style={{ color: tokens.colorNeutralForeground2 }}>Images</span>
            <span style={{ fontWeight: 600 }}>{prompt.images.length}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {prompt.tags && prompt.tags.length > 0 && (
        <div className={mergeClasses(styles.sidebarCard, isDark && styles.sidebarCardDark)}>
          <Title3 style={{ marginBottom: '12px' }}>Tags</Title3>
          <div className={styles.tagsContainer}>
            {prompt.tags.map((tag, index) => (
              <Badge key={index} appearance="outline" size="small">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
