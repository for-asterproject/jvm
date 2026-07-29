import { CrmAvatar } from '@/components/crm/crm-ui';
import { Checkbox } from '@/components/ui/checkbox';

type AssigneeOption = {
    id: number;
    name: string;
    email?: string;
    roles?: string[];
};

export function AssigneePicker({
    options,
    selectedIds,
    onChange,
}: {
    options: AssigneeOption[];
    selectedIds: number[];
    onChange: (ids: number[]) => void;
}) {
    const toggle = (id: number, checked: boolean) => {
        onChange(checked ? [...new Set([...selectedIds, id])] : selectedIds.filter((selectedId) => selectedId !== id));
    };

    return (
        <div className="crm-scrollbar grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-2 dark:border-white/10 dark:bg-white/[0.02]">
            {options.length === 0 ? (
                <span className="p-3 text-sm text-slate-500 dark:text-slate-400">Нет доступных исполнителей.</span>
            ) : (
                options.map((assignee) => (
                    <label
                        key={assignee.id}
                        className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg p-2 transition hover:bg-blue-50 dark:hover:bg-blue-500/5"
                    >
                        <Checkbox checked={selectedIds.includes(assignee.id)} onCheckedChange={(checked) => toggle(assignee.id, checked === true)} />
                        <CrmAvatar name={assignee.name} className="size-7 rounded-lg" />
                        <span className="min-w-0 text-sm">
                            <span className="block truncate font-medium">{assignee.name}</span>
                            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                {assignee.roles?.join(', ') || assignee.email || 'Сотрудник'}
                            </span>
                        </span>
                    </label>
                ))
            )}
        </div>
    );
}
