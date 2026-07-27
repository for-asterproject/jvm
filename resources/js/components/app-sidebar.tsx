import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { BookOpen, BriefcaseBusiness, CalendarDays, CircleDollarSign, Contact, FileSliders, Folder, LayoutGrid, ShieldCheck } from 'lucide-react';
import AppLogo from './app-logo';

// Навигация нижнего меню
const footerNavItems: NavItem[] = [
    {
        title: 'Репозиторий',
        href: 'https://github.com/laravel/react-starter-kit',
        icon: Folder,
        role: 'Администратор',
    },
    {
        title: 'Документация',
        href: 'https://laravel.com/docs/starter-kits',
        icon: BookOpen,
        role: 'Администратор',
    },
];

export function AppSidebar() {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;
    const roles = user?.roles ?? [];
    const permissions = user?.permissions;

    const mainNavItems: NavItem[] = [
        ...(permissions?.isAdministrator ? [{ title: 'Админ панель', href: '/adminpanel', icon: ShieldCheck, role: 'Администратор' }] : []),
        ...(roles.includes('Бухгалтер') ? [{ title: 'Бухгалтерия', href: '/productsmanagment', icon: CircleDollarSign, role: 'Бухгалтер' }] : []),
        { title: 'Панель управления', href: '/dashboard', icon: LayoutGrid, role: '' },
        ...(permissions?.hasCrmAccess
            ? [
                  { title: 'Презентации', href: '/presentations', icon: FileSliders, role: '' },
                  ...(permissions.isStaff ? [{ title: 'Клиентская база', href: '/clients', icon: Contact, role: '' }] : []),
                  { title: 'Проекты JVM', href: '/projects/jvm', icon: BriefcaseBusiness, role: '' },
                  { title: 'Планирование', href: '/planning', icon: CalendarDays, role: '' },
                  { title: 'Проекты PTL', href: '/projects/ptl', icon: BriefcaseBusiness, role: '' },
                  { title: 'Проекты WAP', href: '/projects/wap', icon: BriefcaseBusiness, role: '' },
              ]
            : []),
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
