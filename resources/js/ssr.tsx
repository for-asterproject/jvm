import { createInertiaApp } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import ReactDOMServer from 'react-dom/server';
import { type RouteName, route } from 'ziggy-js';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';
const pages = import.meta.glob(['./pages/**/*.tsx', '!./pages/crm/presentations 2.tsx']);

createServer((page) =>
    createInertiaApp({
        page,
        render: ReactDOMServer.renderToString,
        title: (title) => `${title} - ${appName}`,
        resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, pages),
        setup: ({ App, props }) => {
            /* eslint-disable */
            // @ts-expect-error
            global.route<RouteName> = (name, params, absolute) =>
                route(name, params as any, absolute, {
                    // @ts-expect-error
                    ...page.props.ziggy,
                    // @ts-expect-error
                    location: new URL(page.props.ziggy.location),
                });
            /* eslint-enable */

            return <App {...props} />;
        },
    }),
);
