import React, { useState, useEffect } from 'react';
import {
  makeStyles,
  shorthands,
  tokens,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Input,
  Textarea,
  Dropdown,
  Option,
  Label,
  Field,
  Toast,
  useToastController,
  useId,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  Checkmark24Regular,
  Add24Regular,
} from '@fluentui/react-icons';
import { API_ENDPOINTS } from '../config';

const useStyles = makeStyles({
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('20px'),
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    ...shorthands.gap('16px'),
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },
  fullWidth: {
    gridColumn: '1 / -1',
  },
  textarea: {
    minHeight: '200px',
  },
  tagsInput: {
    minHeight: '60px',
  },
});

export default function CreatePromptModal({ isOpen, onClose, onUpdate }) {
  const styles = useStyles();
  const toasterId = useId('create-prompt-toaster');
  const { dispatchToast } = useToastController(toasterId);

  const [formData, setFormData] = useState({
    title: '',
    department: '',
    subcategory: '',
    description: '',
    content: '',
    tags: '',
    icon: '⚡',
    complexity: 'intermediate',
    tips: '',
    additionalTips: '',
    whatItDoes: '',
    howToUse: '',
    exampleInput: '',
    exampleOutput: '',
    images: '',
    promptCategory: '',
    worksIn: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [promptCategories, setPromptCategories] = useState([]);
  const [worksInOptions, setWorksInOptions] = useState([]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        department: '',
        subcategory: '',
        description: '',
        content: '',
        tags: '',
        icon: '⚡',
        complexity: 'intermediate',
        tips: '',
        additionalTips: '',
        whatItDoes: '',
        howToUse: '',
        exampleInput: '',
        exampleOutput: '',
        images: '',
        promptCategory: '',
        worksIn: '',
      });
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Fetch all dropdown options from API when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadOptions = async () => {
        try {
          const [departmentsRes, subcategoriesRes, categoriesRes, worksInRes] = await Promise.all([
            fetch(`${API_ENDPOINTS.API_URL}/api/admin/departments`),
            fetch(`${API_ENDPOINTS.API_URL}/api/admin/subcategories`),
            fetch(`${API_ENDPOINTS.API_URL}/api/admin/prompt-categories`),
            fetch(`${API_ENDPOINTS.API_URL}/api/admin/works-in`)
          ]);

          if (departmentsRes.ok) {
            const depts = await departmentsRes.json();
            setDepartments(depts);
          }

          if (subcategoriesRes.ok) {
            const subs = await subcategoriesRes.json();
            setSubcategories(subs);
          }

          if (categoriesRes.ok) {
            const categories = await categoriesRes.json();
            setPromptCategories(categories);
          }

          if (worksInRes.ok) {
            const worksIn = await worksInRes.json();
            setWorksInOptions(worksIn);
          }
        } catch (error) {
          console.error('Error loading options:', error);
        }
      };
      loadOptions();
    }
  }, [isOpen]);

  // Update icon when department changes
  useEffect(() => {
    if (formData.department) {
      const dept = departments.find(d => d.name === formData.department);
      if (dept && dept.icon !== formData.icon) {
        setFormData(prev => ({ ...prev, icon: dept.icon }));
      }
    }
  }, [formData.department, departments]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.department) {
      newErrors.department = 'Department is required';
    }

    if (!formData.subcategory.trim()) {
      newErrors.subcategory = 'Subcategory is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 50) {
      newErrors.description = 'Description must be at least 50 characters';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Prompt content is required';
    } else if (formData.content.trim().length < 100) {
      newErrors.content = 'Prompt content must be at least 100 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      dispatchToast(
        <Toast>
          <div>❌ Please fix the errors before submitting</div>
        </Toast>,
        { intent: 'error' }
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('adminToken');

      // Prepare tags
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      // Prepare tips
      const tipsArray = formData.tips
        .split('\n')
        .map(tip => tip.trim())
        .filter(tip => tip.length > 0);

      // Prepare additional tips
      const additionalTipsArray = formData.additionalTips
        .split('\n')
        .map(tip => tip.trim())
        .filter(tip => tip.length > 0);

      // Prepare images
      const imagesArray = formData.images
        .split(',')
        .map(img => img.trim())
        .filter(img => img.length > 0);

      // Prepare works_in platforms
      const worksInArray = formData.worksIn
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);

      // Calculate word count
      const wordCount = formData.content.trim().split(/\s+/).filter(w => w.length > 0).length;

      // Generate unique ID
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 11);
      const id = `prompt_${timestamp}_${random}`;

      // Prepare metadata object
      const metadata = {
        whatItDoes: formData.whatItDoes.trim() || '',
        howToUse: formData.howToUse.trim() || '',
        exampleInput: formData.exampleInput.trim() || ''
      };

      // Prepare new prompt data - all fields at top level for SQL backend
      const newPrompt = {
        id,
        title: formData.title.trim(),
        department: formData.department,
        subcategory: formData.subcategory.trim(),
        description: formData.description.trim(),
        content: formData.content.trim(),
        tags: tagsArray,
        tips: tipsArray,
        additional_tips: additionalTipsArray,
        metadata: metadata,
        example_output: formData.exampleOutput.trim() || '',
        images: imagesArray,
        icon: formData.icon,
        complexity: formData.complexity || 'intermediate',
        word_count: wordCount,
        status: 'approved',
        date: new Date().toISOString().split('T')[0],
        prompt_category: formData.promptCategory || null,
        works_in_json: worksInArray.length > 0 ? JSON.stringify(worksInArray) : null,
      };

      // Send to API server
      const response = await fetch(API_ENDPOINTS.ADMIN_CREATE_PROMPT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newPrompt),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create prompt');
      }

      const result = await response.json();

      // Call the onUpdate callback to refresh the prompt list
      if (result.success || result.prompt) {
        await onUpdate();
      }

      dispatchToast(
        <Toast>
          <div>✅ Prompt created successfully!</div>
        </Toast>,
        { intent: 'success' }
      );

      // Close modal
      onClose();
    } catch (error) {
      console.error('Error creating prompt:', error);
      dispatchToast(
        <Toast>
          <div>❌ Failed to create prompt: {error.message}</div>
        </Toast>,
        { intent: 'error' }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(event, data) => !data.open && onClose()}>
      <DialogSurface style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
        <DialogBody>
          <DialogTitle
            action={
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                onClick={onClose}
                disabled={isSubmitting}
              />
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Add24Regular />
              <span>Create New Prompt</span>
            </div>
          </DialogTitle>

          <DialogContent className={styles.dialogContent}>
            <div className={styles.formGrid}>
              {/* Title */}
              <Field
                label="Prompt Title"
                required
                validationMessage={errors.title}
                validationState={errors.title ? 'error' : undefined}
                className={styles.fullWidth}
              >
                <Input
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g., Analyze Business Cost Structure"
                  disabled={isSubmitting}
                />
              </Field>

              {/* Department */}
              <Field
                label="Department"
                required
                validationMessage={errors.department}
                validationState={errors.department ? 'error' : undefined}
              >
                <Dropdown
                  placeholder="Select department"
                  value={formData.department}
                  onOptionSelect={(e, data) => handleChange('department', data.optionValue || '')}
                  disabled={isSubmitting}
                >
                  {departments.map(dept => (
                    <Option key={dept.id} value={dept.name}>
                      {dept.icon} {dept.name}
                    </Option>
                  ))}
                </Dropdown>
              </Field>

              {/* Subcategory */}
              <Field
                label="Subcategory"
                required
                validationMessage={errors.subcategory}
                validationState={errors.subcategory ? 'error' : undefined}
              >
                <Input
                  value={formData.subcategory}
                  onChange={(e) => handleChange('subcategory', e.target.value)}
                  placeholder="e.g., Analytics & Research"
                  disabled={isSubmitting}
                />
              </Field>

              {/* Prompt Category */}
              <Field
                label="Prompt Category"
                hint="Optional - categorize by action type"
              >
                <Dropdown
                  placeholder="Select category (optional)"
                  value={formData.promptCategory}
                  onOptionSelect={(e, data) => handleChange('promptCategory', data.optionValue || '')}
                  disabled={isSubmitting}
                >
                  <Option value="">None</Option>
                  {promptCategories.map(category => (
                    <Option key={category.id} value={category.name}>
                      {category.name}
                    </Option>
                  ))}
                </Dropdown>
              </Field>

              {/* Works In Platforms */}
              <Field
                label="Works In Platforms"
                hint="Optional - comma-separated platforms (e.g., Teams, ChatGPT)"
              >
                <Input
                  value={formData.worksIn}
                  onChange={(e) => handleChange('worksIn', e.target.value)}
                  placeholder="e.g., Teams, Outlook, ChatGPT"
                  disabled={isSubmitting}
                />
              </Field>

              {/* Description */}
              <Field
                label="Description"
                required
                validationMessage={errors.description}
                validationState={errors.description ? 'error' : undefined}
                className={styles.fullWidth}
                hint="Provide a brief description of what this prompt does (minimum 50 characters)"
              >
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="💡Optimize your business's financial performance with this mega-prompt..."
                  className={styles.tagsInput}
                  disabled={isSubmitting}
                />
              </Field>

              {/* Prompt Content */}
              <Field
                label="Prompt Content"
                required
                validationMessage={errors.content}
                validationState={errors.content ? 'error' : undefined}
                className={styles.fullWidth}
                hint="The full prompt text (minimum 100 characters)"
              >
                <Textarea
                  value={formData.content}
                  onChange={(e) => handleChange('content', e.target.value)}
                  placeholder="#CONTEXT:&#10;You are an expert...&#10;&#10;#GOAL:&#10;...&#10;&#10;#RESPONSE GUIDELINES:&#10;..."
                  className={styles.textarea}
                  disabled={isSubmitting}
                />
              </Field>

              {/* Tags */}
              <Field
                label="Tags"
                hint="Comma-separated tags (e.g., analysis, strategy, planning)"
              >
                <Input
                  value={formData.tags}
                  onChange={(e) => handleChange('tags', e.target.value)}
                  placeholder="analysis, strategy, planning"
                  disabled={isSubmitting}
                />
              </Field>

              {/* Complexity */}
              <Field
                label="Complexity Level"
                hint="Select the difficulty level"
              >
                <Dropdown
                  placeholder="Select complexity"
                  value={formData.complexity}
                  onOptionSelect={(e, data) => handleChange('complexity', data.optionValue || '')}
                  disabled={isSubmitting}
                >
                  <Option value="beginner">🟢 Beginner</Option>
                  <Option value="intermediate">🟡 Intermediate</Option>
                  <Option value="advanced">🔴 Advanced</Option>
                </Dropdown>
              </Field>

              {/* Tips */}
              <Field
                label="Tips"
                className={styles.fullWidth}
                hint="One tip per line - helpful usage suggestions for this prompt"
              >
                <Textarea
                  value={formData.tips}
                  onChange={(e) => handleChange('tips', e.target.value)}
                  placeholder="Prioritize the classification of expenses into fixed and variable costs...&#10;Utilize industry-specific benchmarks for comparative analysis...&#10;Develop a continuous improvement plan..."
                  className={styles.tagsInput}
                  disabled={isSubmitting}
                />
              </Field>

              {/* Additional Tips */}
              <Field
                label="💡 Additional Tips (optional)"
                className={styles.fullWidth}
                hint="One additional tip per line"
              >
                <Textarea
                  value={formData.additionalTips}
                  onChange={(e) => handleChange('additionalTips', e.target.value)}
                  placeholder="Enter additional tips, one per line..."
                  className={styles.tagsInput}
                  disabled={isSubmitting}
                />
              </Field>

              {/* What It Does */}
              <Field
                label="What This Prompt Does"
                className={styles.fullWidth}
                hint="Bullet points explaining the capabilities (use • or ● for bullets)"
              >
                <Textarea
                  value={formData.whatItDoes}
                  onChange={(e) => handleChange('whatItDoes', e.target.value)}
                  placeholder="● Conducts a detailed financial analysis...&#10;● Compares costs against industry benchmarks...&#10;● Provides actionable recommendations..."
                  className={styles.tagsInput}
                  disabled={isSubmitting}
                />
              </Field>

              {/* How To Use */}
              <Field
                label="How To Use This Prompt"
                className={styles.fullWidth}
                hint="Step-by-step instructions (use • or ● for bullet points)"
              >
                <Textarea
                  value={formData.howToUse}
                  onChange={(e) => handleChange('howToUse', e.target.value)}
                  placeholder="● Fill in the placeholders [DESCRIBE YOUR BUSINESS]...&#10;● Example: If your business is a small bakery..."
                  className={styles.tagsInput}
                  disabled={isSubmitting}
                />
              </Field>

              {/* Example Input */}
              <Field
                label="Example Input"
                className={styles.fullWidth}
                hint="A filled-in example showing real-world usage (use • or ● for bullets)"
              >
                <Textarea
                  value={formData.exampleInput}
                  onChange={(e) => handleChange('exampleInput', e.target.value)}
                  placeholder="#INFORMATION ABOUT ME:&#10;● My business: Spark, the biggest collection of easy-to-follow AI resources...&#10;● Industry sector: Digital Marketing and AI Resources..."
                  className={styles.tagsInput}
                  disabled={isSubmitting}
                />
              </Field>

              {/* Example Output */}
              <Field
                label="📤 Example Output (optional)"
                className={styles.fullWidth}
                hint="Show what the output looks like, or reference an image filename"
              >
                <Textarea
                  value={formData.exampleOutput}
                  onChange={(e) => handleChange('exampleOutput', e.target.value)}
                  placeholder="Example output text or image filename..."
                  className={styles.tagsInput}
                  disabled={isSubmitting}
                />
              </Field>

              {/* Images */}
              <Field
                label="Example Output Images"
                className={styles.fullWidth}
                hint="Comma-separated image filenames (e.g., example1.png, example2.png)"
              >
                <Input
                  value={formData.images}
                  onChange={(e) => handleChange('images', e.target.value)}
                  placeholder="example1.png, example2.png"
                  disabled={isSubmitting}
                />
              </Field>
            </div>

            {/* Character counts */}
            <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: tokens.colorNeutralForeground2 }}>
              <span>Description: {formData.description.length} characters</span>
              <span>Content: {formData.content.length} characters</span>
              <span>Words: {formData.content.trim().split(/\s+/).filter(w => w.length > 0).length}</span>
            </div>
          </DialogContent>

          <DialogActions>
            <Button
              appearance="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              appearance="primary"
              icon={<Checkmark24Regular />}
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Prompt'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
