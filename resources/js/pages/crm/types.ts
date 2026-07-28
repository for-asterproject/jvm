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
export type TaskStatus = 'planned' | 'in_progress' | 'review' | 'done';

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

export interface TaskRecord {
    id: number;
    project_id: number;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: Priority;
    assignee_id: number;
    assignee: UserSummary;
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
    can_comment: boolean;
    created_at: string;
}

export type FormErrors = Record<string, string>;
