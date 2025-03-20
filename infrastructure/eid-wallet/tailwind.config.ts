import containerQueries from '@tailwindcss/container-queries';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';
import daisyui from 'daisyui';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	darkMode: 'class',
	theme: {
		extend: {
			fontFamily: {
				sans: ['Inter', 'sans-serif']
			},
			animation: {
				'spin-slow': 'spin 3s linear infinite'
			},
			colors: {
				primary: {
					900: '#362F78',
					800: '#42389D',
					700: '#5145CD',
					600: '#5850EC',
					500: '#6875F5',
					400: '#8DA2FB',
					300: '#B4C6FC',
					200: '#CDDBFE',
					100: '#E5EDFF',
					50: '#F0F5FF'
				},
				secondary: {
					900: '#111928',
					800: '#1F2A37',
					700: '#374151',
					600: '#4B5563',
					500: '#6B7280',
					400: '#9CA3AF',
					300: '#D1D5DB',
					200: '#E5E7EB',
					100: '#F3F4F6',
					50: '#F9FAFB'
				},
				danger: {
					900: '#771D1D',
					800: '#9B1C1C',
					700: '#C81E1E',
					600: '#E02424',
					500: '#F05252',
					400: '#F98080',
					300: '#F8B4B4',
					200: '#FBD5D5',
					100: '#FDE8E8',
					50: '#FDF2F2'
				},
				success: {
					900: '#014737',
					800: '#03543F',
					700: '#046C4E',
					600: '#057A55',
					500: '#0E9F6E',
					400: '#31C48D',
					300: '#84E1BC',
					200: '#BCF0DA',
					100: '#DEF7EC',
					50: '#F3FAF7'
				},
				darker: {
					card: '#171A27',
					background: '#0B0D13'
				}
			},
			daisyui: {
				darkTheme: 'light'
			}
		}
	},

	plugins: [typography, forms, containerQueries, daisyui]
} satisfies Config;
