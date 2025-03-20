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
				sans: ['Archivo', 'sans-serif']
			},
			animation: {
				'spin-slow': 'spin 3s linear infinite'
			},
			colors: {
				primary: {
					900: '#8E52FF',
					700: '#A575FF',
					500: '#BB97FF',
					300: '#D2BAFF',
					100: '#E8DCFF',
				},
				secondary: {
					900: '#73EFD5',
					700: '#8FF2DD',
					500: '#ABF6E6',
					300: '#C7F9EE',
					100: '#E3FCF7',
				},
				gray: {
					900: '#F5F5F5'
				},
				white: {
					900: "#FFFFFF"
				},
				black: {
					900: '#171A27',
					700: '#4C4C4C',
					500: "#797979",
					300: "#A5A5A5",
					100: "#D2D2D2"
				}
			},
			daisyui: {
				darkTheme: 'light'
			}
		},
		daisyui: {
			themes: false, // Disable built-in themes
		}
	},

	plugins: [typography, forms, containerQueries, daisyui]
} satisfies Config;
