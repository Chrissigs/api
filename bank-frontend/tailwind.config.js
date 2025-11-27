/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'bank-blue': '#003366',
                'bank-gold': '#C5A059',
                'bank-gray': '#F5F7FA',
            },
            fontFamily: {
                'sans': ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
