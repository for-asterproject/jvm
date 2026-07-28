import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import '@/pages/css/all.css';

export default function Welcome() {
    const { auth } = usePage<SharedData>().props;

    return (
        <>
        <Head title="Добро пожаловать">
            <link rel="preconnect" href="https://fonts.bunny.net" />
            <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />
        </Head>
        <div className="flex min-h-screen flex-col items-center bg-[#FDFDFC] p-6 text-[#1b1b18] lg:justify-center lg:p-8 dark:bg-[#0a0a0a]">
            <header 
                className="mb-6 w-full max-w-[335px] text-sm not-has-[nav]:hidden lg:max-w-4xl"
            >
                <nav className="flex items-center justify-end gap-4">
                    {auth.user ? (
                        <Link
                            href={route('dashboard')}
                            className="inline-block rounded-sm border border-[#19140035] px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#1915014a] dark:border-[#3E3E3A] dark:text-[#EDEDEC] dark:hover:border-[#62605b]"
                        >
                            Прайс Лист
                        </Link>
                    ) : (
                        <>
                            <Link
                                href={route('login')}
                                className="inline-block rounded-sm border border-transparent px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#19140035] dark:text-[#EDEDEC] dark:hover:border-[#3E3E3A]"
                            >
                                Войти
                            </Link>
                            <Link
                                href={route('register')}
                                className="inline-block rounded-sm border border-[#19140035] px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#1915014a] dark:border-[#3E3E3A] dark:text-[#EDEDEC] dark:hover:border-[#62605b]"
                            >
                                Зарегистрироваться
                            </Link>
                        </>
                    )}
                </nav>
            </header>

            <div className="flex flex-col items-center">
                {/* Логотип компании */}
                <img 
                    src="https://static.tildacdn.pro/tild3865-3764-4331-b030-633836343931/Aster_Project_-_LOGO.png" 
                    alt="Aster Project Logo" 
                    className="mb-4 w-40 h-auto" 
                />

                {/* Приветственное сообщение */}
                <h1 className="text-2xl font-semibold text-center">
                    Добро пожаловать!
                </h1>
                <p className="text-center text-lg text-gray-600 mt-2">
                    Мы рады видеть вас здесь.
                </p>
            </div>
        </div>
        </>
    );
}
