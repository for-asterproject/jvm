export interface UserSummary {
    id: number;
    name: string;
    email?: string;
    roles?: string[];
}

export interface ClientRecord {
    id: number;
    company_name: string;
    bin: string | null;
    contact_name: string | null;
    position: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    status: 'active' | 'inactive';
    notes: string | null;
    creator?: UserSummary | null;
    created_at: string;
}

export interface PresentationRecord {
    id: number;
    title: string;
    description: string | null;
    attachments: PresentationAttachmentRecord[];
    attachments_count: number;
    total_size: number;
    uploader?: UserSummary | null;
    created_at: string;
    updated_at: string;
}

export interface PresentationAttachmentRecord {
    id: number;
    kind: 'file' | 'link';
    media_type: 'image' | 'video' | 'document' | 'archive' | 'link';
    display_name: string;
    url: string | null;
    original_name: string | null;
    mime_type: string | null;
    size: number;
    status: 'uploading' | 'ready' | 'failed';
    sort_order: number;
    view_url: string | null;
    download_url: string | null;
    created_at: string;
}

export interface PresentationLimits {
    max_attachments: number;
    max_file_size: number;
    max_total_size: number;
    chunk_size: number;
    parallel_uploads: number;
    allowed_extensions: string[];
}

export type ProjectStatus = 'new' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
export type Priority = 'low' | 'normal' | 'high';
export type TaskStatus = 'planned' | 'in_progress' | 'review' | 'needs_revision' | 'done';
export type TaskReportStatus = 'pending' | 'accepted' | 'revision_requested';

export interface ProjectRecord {
    id: number;
    division: 'jvm' | 'ptl' | 'wap';
    name: string;
    client_name: string | null;
    description: string | null;
    status: ProjectStatus;
    priority: Priority;
    manager_id: number;
    manager: UserSummary;
    members: UserSummary[];
    start_date: string | null;
    due_date: string | null;
    budget: string | null;
    budget_currency: 'KZT' | 'USD';
    notes: string | null;
    tasks_count: number;
    can_manage: boolean;
    created_at: string;
}

export interface PlanningProject {
    id: number;
    name: string;
    division: 'jvm' | 'ptl' | 'wap';
    manager: UserSummary;
    participants: UserSummary[];
    can_manage: boolean;
}

export interface TaskCommentRecord {
    id: number;
    body: string;
    user: UserSummary | null;
    created_at: string;
}

export interface TaskReportAttachmentRecord {
    id: number;
    media_type: 'image' | 'video' | 'document' | 'archive';
    display_name: string;
    mime_type: string | null;
    size: number;
    view_url: string;
    download_url: string;
}

export interface TaskReportRecord {
    id: number;
    body: string;
    status: TaskReportStatus;
    author: UserSummary;
    reviewer: UserSummary | null;
    review_comment: string | null;
    reviewed_at: string | null;
    created_at: string;
    attachments: TaskReportAttachmentRecord[];
}

export interface TaskAssignmentRecord {
    id: number;
    user_id: number;
    user: UserSummary;
    status: TaskStatus;
    started_at: string | null;
    submitted_at: string | null;
    completed_at: string | null;
    is_current_user: boolean;
    can_start: boolean;
    can_submit_report: boolean;
    reports?: TaskReportRecord[];
}

export interface TaskReportLimits {
    max_attachments: number;
    max_file_size: number;
    chunk_size: number;
    allowed_extensions: string[];
}

export interface TaskRecord {
    id: number;
    division: 'jvm' | 'ptl' | 'wap';
    project_id: number;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: Priority;
    assignee_id: number;
    assignee: UserSummary;
    assignees: UserSummary[];
    assignments: TaskAssignmentRecord[];
    assignments_count: number;
    accepted_reports_count: number;
    creator: UserSummary | null;
    project: {
        id: number;
        name: string;
        division: 'jvm' | 'ptl' | 'wap';
        manager_id: number;
    };
    due_date: string | null;
    comments: TaskCommentRecord[];
    can_manage: boolean;
    can_change_status: boolean;
    can_review_reports: boolean;
    can_comment: boolean;
    created_at: string;
}

export interface DivisionTaskRecord extends Omit<TaskRecord, 'project_id' | 'project'> {
    project_id: number | null;
    project: TaskRecord['project'] | null;
}

export type FormErrors = Record<string, string>;
