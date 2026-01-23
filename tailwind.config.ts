import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: ["class"],
    theme: {
        screens: {
            'xs': '360px',
            'sm': '640px',
            'md': '768px',
            'lg': '1024px',
            'xl': '1280px',
            '2xl': '1536px',
            // Landscape-specific: use with @media (orientation: landscape)
            'landscape': { 'raw': '(orientation: landscape) and (min-width: 640px) and (max-width: 932px)' },
        },
        extend: {
            fontFamily: {
                sans: ["var(--font-noto-sans-jp)", "var(--font-manrope)", "sans-serif"],
                jp: ["var(--font-noto-sans-jp)", "sans-serif"],
                display: ["var(--font-manrope)", "sans-serif"],
            },
            colors: {
                border: "var(--border)",
                input: "var(--input)",
                ring: "var(--ring)",
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: {
                    DEFAULT: "var(--primary)",
                    foreground: "var(--primary-foreground)",
                },
                secondary: {
                    DEFAULT: "var(--secondary)",
                    foreground: "var(--secondary-foreground)",
                },
                destructive: {
                    DEFAULT: "var(--accent)",
                    foreground: "var(--accent-foreground)",
                },
                muted: {
                    DEFAULT: "var(--muted)",
                    foreground: "var(--muted-foreground)",
                },
                accent: {
                    DEFAULT: "var(--accent)",
                    foreground: "var(--accent-foreground)",
                },
                popover: {
                    DEFAULT: "var(--background)",
                    foreground: "var(--foreground)",
                },
                card: {
                    DEFAULT: "var(--background)",
                    foreground: "var(--foreground)",
                },
                surface: {
                    50: "var(--surface-50)",
                    100: "var(--surface-100)",
                    200: "var(--surface-200)",
                }
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "gradient-conic":
                    "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
            },
        },
    },
    plugins: [],
};
export default config;
