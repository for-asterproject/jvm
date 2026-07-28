import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { UserProvider } from './components/UserContext';
import { initializeTheme } from './hooks/use-appearance';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';
const pages = import.meta.glob(['./pages/**/*.tsx', '!./pages/crm/presentations 2.tsx']);

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, pages),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <UserProvider>
                <App {...props} />
            </UserProvider>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
