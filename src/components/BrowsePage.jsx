/**
 * Teams Prompt Library - Browse Page
 * Adapted from SPARK AI for Teams integration
 */

import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Card,
  Input,
  Dropdown,
  Option,
  Badge,
  Spinner,
  Toast,
  Toaster,
  useToastController,
  useId,
} from '@fluentui/react-components';
import {
  Search24Regular,
  Grid24Regular,
  List24Regular,
  Dismiss24Regular,
  ArrowLeft24Regular,
  ArrowRight24Filled,
  Image24Regular,
  Checkmark24Filled,
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
  filtersSection: {
    marginBottom: '24px',
  },
  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr auto',
    ...shorthands.gap('12px'),
    marginBottom: '16px',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },
  searchInput: {
    width: '100%',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  viewButtons: {
    display: 'flex',
    ...shorthands.gap('8px'),
  },
  resultsInfo: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    ...shorthands.gap('16px'),
    marginBottom: '32px',
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('12px'),
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
  promptListItem: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('16px'),
    ...shorthands.padding('16px'),
    ...glass.card,
    ...shorthands.borderRadius('8px'),
    cursor: 'pointer',
  },
  promptListItemDark: {
    ...glass.cardDark,
  },
  promptIcon: {
    fontSize: '32px',
  },
  promptContent: {
    flex: 1,
    minWidth: 0,
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    ...shorthands.gap('8px'),
    marginTop: '8px',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  emptyState: {
    textAlign: 'center',
    ...shorthands.padding('64px', '24px'),
  },
  emptyIcon: {
    fontSize: '72px',
    marginBottom: '20px',
  },
});

const PROMPTS_PER_PAGE = 30;

export default function BrowsePage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme, isInTeams } = useContext(AppContext);
  const isDark = theme === 'dark' || theme === 'contrast';

  const [allPrompts, setAllPrompts] = useState([]);
  const [filteredPrompts, setFilteredPrompts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedDepartment, setSelectedDepartment] = useState(searchParams.get('department') || '');
  const [selectedSubcategory, setSelectedSubcategory] = useState(searchParams.get('subcategory') || '');
  const [sortBy, setSortBy] = useState('title');
  const [viewMode, setViewMode] = useState('card');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedPromptId, setCopiedPromptId] = useState(null);

  const toasterId = useId('toaster');
  const { dispatchToast } = useToastController(toasterId);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedDepartment, selectedSubcategory, sortBy, allPrompts]);

  const loadData = async () => {
    try {
      const token = await getAccessToken();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

      const [promptsRes, deptsRes] = await Promise.all([
        fetch(`${apiUrl}/prompts`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        fetch(`${apiUrl}/departments`)
      ]);

      if (!promptsRes.ok || !deptsRes.ok) {
        throw new Error('API request failed');
      }

      const [promptsData, deptsData] = await Promise.all([
        promptsRes.json(),
        deptsRes.json()
      ]);

      const prompts = Array.isArray(promptsData.prompts) ? promptsData.prompts : promptsData;
      const depts = Array.isArray(deptsData) ? deptsData : [];

      setAllPrompts(prompts);
      setDepartments(depts);
    } catch (error) {
      console.error('Failed to load prompts:', error);
      dispatchToast(
        <Toast>
          <div>⚠️ Failed to load prompts. Please try again.</div>
        </Toast>,
        { intent: 'error' }
      );
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allPrompts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(prompt =>
        prompt.title.toLowerCase().includes(query) ||
        (prompt.description || '').toLowerCase().includes(query) ||
        (prompt.subcategory || '').toLowerCase().includes(query) ||
        (prompt.tags || []).some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Department filter
    if (selectedDepartment) {
      filtered = filtered.filter(prompt => prompt.department === selectedDepartment);
    }

    // Subcategory filter
    if (selectedSubcategory) {
      filtered = filtered.filter(prompt => prompt.subcategory === selectedSubcategory);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'date') {
        return new Date(b.created_at || b.date) - new Date(a.created_at || a.date);
      } else if (sortBy === 'department') {
        return a.department.localeCompare(b.department) || a.title.localeCompare(b.title);
      }
      return 0;
    });

    setFilteredPrompts(filtered);
    setCurrentPage(1);
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    if (value) {
      searchParams.set('search', value);
    } else {
      searchParams.delete('search');
    }
    setSearchParams(searchParams);
  };

  const handleDepartmentChange = (value) => {
    setSelectedDepartment(value);
    setSelectedSubcategory('');
    if (value) {
      searchParams.set('department', value);
    } else {
      searchParams.delete('department');
    }
    searchParams.delete('subcategory');
    setSearchParams(searchParams);
  };

  const handleSubcategoryChange = (value) => {
    setSelectedSubcategory(value);
    if (value) {
      searchParams.set('subcategory', value);
    } else {
      searchParams.delete('subcategory');
    }
    setSearchParams(searchParams);
  };

  const getAvailableSubcategories = () => {
    if (!selectedDepartment) return [];

    const subcategoriesSet = new Set();
    allPrompts
      .filter(prompt => prompt.department === selectedDepartment)
      .forEach(prompt => {
        if (prompt.subcategory) {
          subcategoriesSet.add(prompt.subcategory);
        }
      });

    return Array.from(subcategoriesSet).sort();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedDepartment('');
    setSelectedSubcategory('');
    setSortBy('title');
    setSearchParams({});
  };

  const handlePromptClick = (promptId) => {
    navigate(`/view/${promptId}`);
  };

  const copyToClipboard = async (event, prompt) => {
    event.stopPropagation();

    if (!prompt?.content) return;

    try {
      await navigator.clipboard.writeText(prompt.content);

      setCopiedPromptId(prompt.id);

      dispatchToast(
        <Toast>
          <div>✅ Copied to clipboard!</div>
        </Toast>,
        { intent: 'success' }
      );

      setTimeout(() => setCopiedPromptId(null), 2000);
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

  const sharePrompt = async (event, prompt) => {
    event.stopPropagation();

    if (isInTeams) {
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
        dispatchToast(
          <Toast>
            <div>Failed to share prompt</div>
          </Toast>,
          { intent: 'error' }
        );
      }
    } else {
      // Fallback: copy link
      try {
        const url = `${window.location.origin}/view/${prompt.id}`;
        await navigator.clipboard.writeText(url);
        dispatchToast(
          <Toast>
            <div>✅ Link copied to clipboard!</div>
          </Toast>,
          { intent: 'success' }
        );
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
    }
  };

  const getPagePrompts = () => {
    const start = (currentPage - 1) * PROMPTS_PER_PAGE;
    const end = start + PROMPTS_PER_PAGE;
    return filteredPrompts.slice(start, end);
  };

  const getTotalPages = () => {
    return Math.ceil(filteredPrompts.length / PROMPTS_PER_PAGE);
  };

  const renderCard = (prompt) => (
    <Card
      key={prompt.id}
      className={mergeClasses(styles.promptCard, isDark && styles.promptCardDark)}
      onClick={() => handlePromptClick(prompt.id)}
    >
      <div style={{ padding: '12px' }}>
        {(prompt.images && prompt.images.length > 0) && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            color: tokens.colorNeutralForeground3,
          }}>
            <Image24Regular />
          </div>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '24px' }}>{prompt.icon}</span>
          <Title3
            block
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {prompt.title}
          </Title3>
          <Badge appearance="filled" color="brand" size="small">
            {prompt.department}
          </Badge>
        </div>

        <Body2 block style={{ marginBottom: '8px', color: tokens.colorNeutralForeground2 }}>
          {(prompt.description || '').substring(0, 100)}...
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
          <span style={{
            fontSize: '12px',
            color: tokens.colorNeutralForeground2
          }}>
            {prompt.word_count} words
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <Button
              appearance="subtle"
              size="small"
              icon={copiedPromptId === prompt.id ? <Checkmark24Filled /> : undefined}
              onClick={(e) => copyToClipboard(e, prompt)}
            >
              {copiedPromptId === prompt.id ? 'Copied!' : 'Copy'}
            </Button>
            {isInTeams && (
              <Button
                appearance="subtle"
                size="small"
                icon={<Share24Regular />}
                onClick={(e) => sharePrompt(e, prompt)}
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );

  const renderListItem = (prompt) => (
    <div
      key={prompt.id}
      className={mergeClasses(styles.promptListItem, isDark && styles.promptListItemDark)}
      onClick={() => handlePromptClick(prompt.id)}
    >
      <span className={styles.promptIcon}>{prompt.icon}</span>

      <div className={styles.promptContent}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Badge appearance="filled" color="brand" size="small">
            {prompt.department}
          </Badge>
          <Title3>{prompt.title}</Title3>
        </div>
        <Body2 style={{ color: tokens.colorNeutralForeground2 }}>
          {(prompt.description || '').substring(0, 100)}...
        </Body2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {prompt.images && prompt.images.length > 0 && <Image24Regular />}
        <Body2>{prompt.word_count} words</Body2>
        <Button
          appearance="subtle"
          size="small"
          onClick={(e) => copyToClipboard(e, prompt)}
        >
          Copy
        </Button>
      </div>
    </div>
  );

  const renderPagination = () => {
    const totalPages = getTotalPages();
    if (totalPages <= 1) return null;

    return (
      <div className={styles.pagination}>
        <Button
          appearance="subtle"
          icon={<ArrowLeft24Regular />}
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
        >
          Previous
        </Button>

        <span style={{ padding: '0 16px' }}>
          Page {currentPage} of {totalPages}
        </span>

        <Button
          appearance="subtle"
          icon={<ArrowRight24Filled />}
          iconPosition="after"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
        >
          Next
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Spinner size="huge" label="Loading prompts..." />
        </div>
      </div>
    );
  }

  const pagePrompts = getPagePrompts();

  return (
    <div className={styles.container}>
      <Toaster toasterId={toasterId} />

      <div style={{ marginBottom: '24px' }}>
        <Title1 block style={{ marginBottom: '8px' }}>Browse Prompts</Title1>
        <Body1>Explore {filteredPrompts.length.toLocaleString()} AI prompts</Body1>
      </div>

      {/* Filters */}
      <div className={styles.filtersSection}>
        <div className={styles.filtersGrid}>
          <Input
            className={styles.searchInput}
            placeholder="Search prompts..."
            contentBefore={<Search24Regular />}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />

          <Dropdown
            placeholder="All Departments"
            value={selectedDepartment}
            onOptionSelect={(e, data) => handleDepartmentChange(data.optionValue || '')}
          >
            <Option value="">All Departments</Option>
            {departments.map(dept => (
              <Option key={dept.name} value={dept.name}>
                {dept.icon} {dept.name}
              </Option>
            ))}
          </Dropdown>

          <Dropdown
            placeholder="All Subcategories"
            value={selectedSubcategory}
            onOptionSelect={(e, data) => handleSubcategoryChange(data.optionValue || '')}
            disabled={!selectedDepartment}
          >
            <Option value="">All Subcategories</Option>
            {getAvailableSubcategories().map(subcategory => (
              <Option key={subcategory} value={subcategory}>
                {subcategory}
              </Option>
            ))}
          </Dropdown>

          <Button
            appearance="subtle"
            icon={<Dismiss24Regular />}
            onClick={clearFilters}
            disabled={!searchQuery && !selectedDepartment && !selectedSubcategory}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.resultsInfo}>
          <Body1 style={{ fontWeight: 600 }}>
            {filteredPrompts.length.toLocaleString()} {filteredPrompts.length === 1 ? 'prompt' : 'prompts'}
          </Body1>
        </div>

        <div className={styles.viewButtons}>
          <Button
            appearance={viewMode === 'card' ? 'primary' : 'subtle'}
            icon={<Grid24Regular />}
            onClick={() => setViewMode('card')}
          >
            Card
          </Button>
          <Button
            appearance={viewMode === 'list' ? 'primary' : 'subtle'}
            icon={<List24Regular />}
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
        </div>
      </div>

      {/* Results */}
      {pagePrompts.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <Title2 block style={{ marginBottom: '8px' }}>No prompts found</Title2>
          <Body1>Try adjusting your filters</Body1>
        </div>
      ) : viewMode === 'card' ? (
        <div className={styles.gridContainer}>
          {pagePrompts.map(renderCard)}
        </div>
      ) : (
        <div className={styles.listContainer}>
          {pagePrompts.map(renderListItem)}
        </div>
      )}

      {/* Pagination */}
      {renderPagination()}
    </div>
  );
}
