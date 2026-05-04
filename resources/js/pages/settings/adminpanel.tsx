import React, { useState, useEffect } from 'react';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataGrid, GridColDef } from '@mui/x-data-grid';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Админ панель',
        href: '/adminpanel',
    },
];

interface Role {
    id: number;
    name: string;
}

interface User {
    id: number;
    name: string;
    email: string;
    roles: Role[]; // Роли пользователя
    rolesString?: string; // Добавляем строковое поле для ролей
}

export default function AdminPanel() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [newRole, setNewRole] = useState<string>('');
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [passwordUserId, setPasswordUserId] = useState<string>('');
    const [newPassword, setNewPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Загружаем роли и пользователей при монтировании компонента
        axios
            .get('/roles')
            .then((response) => {
                const usersWithRoles = response.data.users.map((user: User) => ({
                    ...user,
                    rolesString: user.roles.map((role) => role.name).join(', ') || 'Роли отсутствуют',
                }));
                setRoles(response.data.roles);
                setUsers(usersWithRoles);
            })
            .catch((error) => {
                console.error('Ошибка загрузки данных:', error);
                setError('Не удалось загрузить данные с сервера.');
            });
    }, []);

    const createRole = () => {
        if (!newRole.trim()) {
            setError('Название роли не может быть пустым.');
            return;
        }
        axios
            .post('/roles', { name: newRole })
            .then((response) => {
                alert(response.data.message);
                setRoles([...roles, response.data.role]);
                setNewRole('');
            })
            .catch((error) => {
                console.error('Ошибка при создании роли:', error);
                setError('Не удалось создать роль.');
            });
    };

    const assignRole = () => {
        if (!selectedUser || !selectedRole) {
            setError('Выберите пользователя и роль.');
            return;
        }
        axios
            .post('/roles/assign', { user_id: selectedUser, role_id: selectedRole })
            .then((response) => {
                alert(response.data.message);
                // Обновляем данные пользователей после назначения роли
                refreshUsers();
            })
            .catch((error) => {
                console.error('Ошибка при назначении роли:', error);
                setError('Не удалось назначить роль.');
            });
    };

    const revokeRole = () => {
        if (!selectedUser || !selectedRole) {
            setError('Выберите пользователя и роль для отмены.');
            return;
        }
        axios
            .post('/roles/revoke', { user_id: selectedUser, role_id: selectedRole })
            .then((response) => {
                alert(response.data.message);
                // Обновляем данные пользователей после отмены роли
                refreshUsers();
            })
            .catch((error) => {
                console.error('Ошибка при отмене роли:', error);
                setError('Не удалось отменить роль.');
            });
    };

    const refreshUsers = () => {
        // Повторная загрузка данных пользователей для обновления интерфейса
        axios
            .get('/roles')
            .then((response) => {
                const usersWithRoles = response.data.users.map((user: User) => ({
                    ...user,
                    rolesString: user.roles.map((role) => role.name).join(', ') || 'Роли отсутствуют',
                }));
                setUsers(usersWithRoles);
            })
            .catch((error) => {
                console.error('Ошибка обновления данных пользователей:', error);
            });
    };

    const deleteUser = (userId: number) => {
        if (!window.confirm('Удалить пользователя? Это действие нельзя отменить.')) {
            return;
        }

        axios
            .delete(`/users/${userId}`)
            .then((response) => {
                alert(response.data.message);
                setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
                if (selectedUser === String(userId)) {
                    setSelectedUser('');
                }
            })
            .catch((error) => {
                console.error('Ошибка при удалении пользователя:', error);
                setError(error.response?.data?.message ?? 'Не удалось удалить пользователя.');
            });
    };

    const updateUserPassword = () => {
        if (!passwordUserId) {
            setError('Выберите пользователя для смены пароля.');
            return;
        }

        if (!newPassword || !confirmPassword) {
            setError('Заполните новый пароль и подтверждение.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Подтверждение пароля не совпадает.');
            return;
        }

        axios
            .put(`/users/${passwordUserId}/password`, {
                password: newPassword,
                password_confirmation: confirmPassword,
            })
            .then((response) => {
                alert(response.data.message);
                setNewPassword('');
                setConfirmPassword('');
                setPasswordUserId('');
                setError(null);
            })
            .catch((error) => {
                console.error('Ошибка при смене пароля:', error);
                setError(error.response?.data?.message ?? 'Не удалось изменить пароль пользователя.');
            });
    };

    // Колонки для DataGrid
    const userColumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 100 }, // Фиксированная ширина
        { field: 'name', headerName: 'Имя', width: 200 },
        { field: 'email', headerName: 'Email', width: 250 },
        { field: 'rolesString', headerName: 'Роли', width: 300 },
        {
            field: 'actions',
            headerName: 'Действия',
            width: 180,
            sortable: false,
            filterable: false,
            renderCell: (params) => (
                <Button
                    type="button"
                    variant="destructive"
                    onClick={() => deleteUser(params.row.id)}
                >
                    Удалить
                </Button>
            ),
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Админ панель" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
            <div style={{ padding: '20px' }}>
                <h2>Управление ролями</h2>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <div>
                    <h3>Создать новую роль</h3>
                    <input
                        type="text"
                        value={newRole}
                        onChange={(e) => {
                            setNewRole(e.target.value);
                            setError(null); // Очистить ошибку
                        }}
                        placeholder="Название роли"
                        style={{ marginRight: '10px' }}
                    />
                    <Button onClick={createRole}>Создать</Button>
                </div>
                <div style={{ marginTop: '20px' }}>
                    <h3>Назначить или отменить роль пользователю</h3>
                    <select
                        onChange={(e) => {
                            setSelectedUser(e.target.value);
                            setError(null); // Очистить ошибку
                        }}
                    >
                        <option value="">Выберите пользователя</option>
                        {users.map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.name}
                            </option>
                        ))}
                    </select>
                    <select
                        onChange={(e) => {
                            setSelectedRole(e.target.value);
                            setError(null); // Очистить ошибку
                        }}
                        style={{ marginLeft: '10px' }}
                    >
                        <option value="">Выберите роль</option>
                        {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                                {role.name}
                            </option>
                        ))}
                    </select>
                    <Button onClick={assignRole} style={{ marginLeft: '10px' }}>
                        Назначить
                    </Button>
                    <Button onClick={revokeRole} style={{ marginLeft: '10px', backgroundColor: 'red' }}>
                        Отменить
                    </Button>
                </div>
                <div style={{ marginTop: '20px' }}>
                    <h3>Сменить пароль пользователю</h3>
                    <select
                        value={passwordUserId}
                        onChange={(e) => {
                            setPasswordUserId(e.target.value);
                            setError(null);
                        }}
                    >
                        <option value="">Выберите пользователя</option>
                        {users.map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.name}
                            </option>
                        ))}
                    </select>
                    <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => {
                            setNewPassword(e.target.value);
                            setError(null);
                        }}
                        placeholder="Новый пароль"
                        className="mt-3 max-w-sm"
                    />
                    <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setError(null);
                        }}
                        placeholder="Подтверждение пароля"
                        className="mt-3 max-w-sm"
                    />
                    <Button onClick={updateUserPassword} style={{ marginTop: '12px' }}>
                        Сменить пароль
                    </Button>
                </div>
                <div style={{ marginTop: '30px' }}>
                    <h3>Список пользователей</h3>
                    <div style={{ height: 400, width: '100%', overflowX: 'auto' }}>
                        <DataGrid
                            rows={users}
                            columns={userColumns}
                            pageSizeOptions={[25, 50, 100]}
                            initialState={{
                                pagination: { paginationModel: { pageSize: 25, page: 0 } },
                            }}
                            pagination
                            sx={{
                                '& .MuiDataGrid-root': {
                                    minWidth: '800px', // Устанавливаем минимальную ширину таблицы
                                    overflowX: 'auto', // Включаем горизонтальный скрол
                                },
                                '& .MuiDataGrid-columnHeaders': {
                                    width: 'auto', // Не фиксируем ширину заголовков
                                },
                            }}
                        />
                    </div>
                </div>
            </div>
            </div>
        </AppLayout>
    );
}
