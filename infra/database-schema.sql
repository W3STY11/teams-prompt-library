-- Enterprise Teams Prompt Library Database Schema
-- Azure SQL Database
-- Multi-tenant architecture with tenant isolation

-- ============================================================================
-- PROMPTS TABLE
-- ============================================================================
CREATE TABLE prompts (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    department VARCHAR(50) NOT NULL,
    subcategory VARCHAR(100),
    description TEXT,
    content TEXT NOT NULL,
    tags NVARCHAR(MAX),  -- JSON array: ["tag1", "tag2"]
    word_count INT,
    complexity VARCHAR(20),  -- Beginner, Intermediate, Advanced
    icon NVARCHAR(10),  -- Emoji or icon identifier
    tips NVARCHAR(MAX),  -- JSON array of usage tips
    images NVARCHAR(MAX),  -- JSON array of image URLs

    -- Multi-tenant fields
    tenant_id VARCHAR(100) NOT NULL,  -- Azure AD tenant ID
    is_shared BIT DEFAULT 0,  -- Shared across tenants?
    visibility VARCHAR(20) DEFAULT 'tenant',  -- 'public', 'tenant', 'team', 'private'
    team_id VARCHAR(100),  -- Teams team ID if team-specific

    -- Metadata
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    created_by VARCHAR(100),  -- Azure AD user ID
    updated_by VARCHAR(100),

    -- Analytics
    view_count INT DEFAULT 0,
    favorite_count INT DEFAULT 0,
    copy_count INT DEFAULT 0,

    -- Version control
    version INT DEFAULT 1,
    previous_version_id VARCHAR(100),

    -- Indexes for multi-tenant queries
    INDEX IX_prompts_tenant (tenant_id, department),
    INDEX IX_prompts_visibility (visibility, is_shared),
    INDEX IX_prompts_created (created_at DESC)
);

-- ============================================================================
-- FULL-TEXT SEARCH INDEX
-- ============================================================================
-- Enable full-text search on prompts table
CREATE FULLTEXT CATALOG promptsCatalog AS DEFAULT;

CREATE FULLTEXT INDEX ON prompts(title, description, content)
    KEY INDEX PK__prompts
    WITH STOPLIST = SYSTEM;

-- ============================================================================
-- FAVORITES TABLE (Cloud storage instead of localStorage)
-- ============================================================================
CREATE TABLE favorites (
    id INT IDENTITY PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,  -- Azure AD user ID
    prompt_id VARCHAR(100) NOT NULL,
    tenant_id VARCHAR(100) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),

    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
    UNIQUE (user_id, prompt_id, tenant_id),
    INDEX IX_favorites_user (user_id, tenant_id)
);

-- ============================================================================
-- DEPARTMENTS TABLE (Reference data)
-- ============================================================================
CREATE TABLE departments (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon NVARCHAR(10),  -- Emoji
    display_order INT DEFAULT 0,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE()
);

-- Insert default departments from SPARK AI
INSERT INTO departments (id, name, description, icon, display_order) VALUES
('business', 'Business', 'General business operations and strategy', '💼', 1),
('marketing', 'Marketing', 'Marketing campaigns and content creation', '📢', 2),
('sales', 'Sales', 'Sales processes and customer engagement', '💰', 3),
('seo', 'SEO', 'Search engine optimization and content strategy', '🔍', 4),
('finance', 'Finance', 'Financial analysis and reporting', '💵', 5),
('education', 'Education', 'Training and educational content', '📚', 6),
('writing', 'Writing', 'Content writing and editing', '✍️', 7),
('productivity', 'Productivity', 'Efficiency and workflow optimization', '⚡', 8),
('solopreneurs', 'Solopreneurs', 'Solo business and entrepreneurship', '🚀', 9);

-- ============================================================================
-- AUDIT LOG TABLE (Compliance & Security)
-- ============================================================================
CREATE TABLE audit_log (
    id INT IDENTITY PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    user_email VARCHAR(255),
    action VARCHAR(50) NOT NULL,  -- 'view', 'copy', 'create', 'update', 'delete', 'favorite', 'search'
    prompt_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    metadata NVARCHAR(MAX),  -- JSON for additional context
    timestamp DATETIME2 DEFAULT GETDATE(),

    INDEX IX_audit_user (user_id, timestamp DESC),
    INDEX IX_audit_action (action, timestamp DESC),
    INDEX IX_audit_prompt (prompt_id, timestamp DESC)
);

-- ============================================================================
-- USERS TABLE (Optional - for extended user profiles)
-- ============================================================================
CREATE TABLE users (
    id VARCHAR(100) PRIMARY KEY,  -- Azure AD user ID
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(200),
    tenant_id VARCHAR(100) NOT NULL,
    department VARCHAR(50),
    role VARCHAR(50) DEFAULT 'user',  -- 'user', 'contributor', 'admin'
    preferences NVARCHAR(MAX),  -- JSON: theme, default department, etc.
    last_login DATETIME2,
    created_at DATETIME2 DEFAULT GETDATE(),

    INDEX IX_users_tenant (tenant_id, role),
    INDEX IX_users_email (email)
);

-- ============================================================================
-- PROMPT SUBMISSIONS TABLE (Approval workflow)
-- ============================================================================
CREATE TABLE prompt_submissions (
    id INT IDENTITY PRIMARY KEY,
    prompt_id VARCHAR(100),  -- NULL until approved
    title VARCHAR(200) NOT NULL,
    department VARCHAR(50) NOT NULL,
    subcategory VARCHAR(100),
    description TEXT,
    content TEXT NOT NULL,
    tags NVARCHAR(MAX),
    submitted_by VARCHAR(100) NOT NULL,
    tenant_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    reviewed_by VARCHAR(100),
    review_notes TEXT,
    submitted_at DATETIME2 DEFAULT GETDATE(),
    reviewed_at DATETIME2,

    INDEX IX_submissions_status (status, submitted_at DESC),
    INDEX IX_submissions_user (submitted_by, tenant_id)
);

-- ============================================================================
-- ANALYTICS TABLE (Usage metrics)
-- ============================================================================
CREATE TABLE analytics_events (
    id BIGINT IDENTITY PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,  -- 'prompt_view', 'prompt_copy', 'search', 'favorite'
    user_id VARCHAR(100),
    prompt_id VARCHAR(100),
    tenant_id VARCHAR(100) NOT NULL,
    search_query VARCHAR(500),
    department VARCHAR(50),
    timestamp DATETIME2 DEFAULT GETDATE(),
    session_id VARCHAR(100),

    -- Partitioned by date for performance
    INDEX IX_analytics_date (timestamp DESC, event_type),
    INDEX IX_analytics_prompt (prompt_id, event_type)
);

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

-- Get prompts for a tenant (with shared prompts)
GO
CREATE PROCEDURE sp_GetPromptsForTenant
    @tenantId VARCHAR(100),
    @department VARCHAR(50) = NULL,
    @searchTerm VARCHAR(200) = NULL,
    @offset INT = 0,
    @limit INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        p.*,
        (SELECT COUNT(*) FROM favorites f WHERE f.prompt_id = p.id AND f.tenant_id = @tenantId) as favorite_count_tenant
    FROM prompts p
    WHERE
        (p.tenant_id = @tenantId OR p.is_shared = 1)
        AND (@department IS NULL OR p.department = @department)
        AND (
            @searchTerm IS NULL
            OR p.title LIKE '%' + @searchTerm + '%'
            OR p.description LIKE '%' + @searchTerm + '%'
            OR CONTAINS((p.title, p.description, p.content), @searchTerm)
        )
    ORDER BY p.created_at DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY;
END;
GO

-- Record analytics event
GO
CREATE PROCEDURE sp_RecordAnalyticsEvent
    @eventType VARCHAR(50),
    @userId VARCHAR(100),
    @promptId VARCHAR(100) = NULL,
    @tenantId VARCHAR(100),
    @searchQuery VARCHAR(500) = NULL,
    @department VARCHAR(50) = NULL,
    @sessionId VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO analytics_events (event_type, user_id, prompt_id, tenant_id, search_query, department, session_id)
    VALUES (@eventType, @userId, @promptId, @tenantId, @searchQuery, @department, @sessionId);

    -- Update prompt analytics counters
    IF @promptId IS NOT NULL
    BEGIN
        IF @eventType = 'prompt_view'
            UPDATE prompts SET view_count = view_count + 1 WHERE id = @promptId;
        ELSE IF @eventType = 'prompt_copy'
            UPDATE prompts SET copy_count = copy_count + 1 WHERE id = @promptId;
    END;
END;
GO

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- Popular prompts by department
GO
CREATE VIEW vw_PopularPromptsByDepartment AS
SELECT
    p.department,
    p.id,
    p.title,
    p.view_count,
    p.copy_count,
    p.favorite_count,
    (p.view_count + p.copy_count * 2 + p.favorite_count * 3) as popularity_score
FROM prompts p
WHERE p.is_shared = 1 OR p.visibility = 'public';
GO

-- User activity summary
GO
CREATE VIEW vw_UserActivity AS
SELECT
    u.id as user_id,
    u.email,
    u.tenant_id,
    COUNT(DISTINCT CASE WHEN a.event_type = 'prompt_view' THEN a.prompt_id END) as prompts_viewed,
    COUNT(DISTINCT CASE WHEN a.event_type = 'prompt_copy' THEN a.prompt_id END) as prompts_copied,
    COUNT(DISTINCT f.prompt_id) as favorites_count,
    MAX(a.timestamp) as last_active
FROM users u
LEFT JOIN analytics_events a ON u.id = a.user_id AND u.tenant_id = a.tenant_id
LEFT JOIN favorites f ON u.id = f.user_id AND u.tenant_id = f.tenant_id
GROUP BY u.id, u.email, u.tenant_id;
GO

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp on prompt modification
GO
CREATE TRIGGER tr_prompts_updated
ON prompts
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE prompts
    SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM inserted);
END;
GO

-- ============================================================================
-- GRANTS (Configure based on your security requirements)
-- ============================================================================
-- Example: Grant read/write to application service account
-- GRANT SELECT, INSERT, UPDATE ON prompts TO [app-service-account];
-- GRANT EXECUTE ON sp_GetPromptsForTenant TO [app-service-account];

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
-- These are automatically created with the table definitions above
-- Additional custom indexes can be added based on query patterns

-- ============================================================================
-- NOTES FOR PRODUCTION
-- ============================================================================
/*
1. Point-in-time restore: Enabled automatically on Azure SQL
2. Backups: Automated backups (7-35 days retention)
3. High Availability: Built-in on S0+ tiers
4. Scaling: Can upgrade to higher tier (S1, S2) without downtime
5. Monitoring: Enable Query Performance Insights in Azure Portal
6. Security:
   - Enable Transparent Data Encryption (TDE) - enabled by default
   - Configure firewall rules to allow only Azure services
   - Use Managed Identity for app connections (no passwords)
7. Cost Optimization:
   - S0 tier ($14.72/month) sufficient for 2,376 items + moderate traffic
   - Monitor DTU usage, upgrade if consistently above 80%
*/
