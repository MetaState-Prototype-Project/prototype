import * as universal_hooks from '../../../src/hooks.ts';

export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19')
];

export const server_loads = [];

export const dictionary = {
		"/": [4],
		"/(protected)/discover": [5,[2]],
		"/(protected)/home": [6,[2]],
		"/(protected)/messages": [7,[2]],
		"/(protected)/messages/[id]": [8,[2]],
		"/(protected)/post": [9,[2]],
		"/(protected)/post/audience": [10,[2]],
		"/(protected)/profile/post": [12,[2]],
		"/(protected)/profile/[id]": [11,[2]],
		"/(protected)/settings": [13,[2,3]],
		"/(protected)/settings/account": [14,[2,3]],
		"/(protected)/settings/account/deactivate": [15,[2,3]],
		"/(protected)/settings/account/username": [16,[2,3]],
		"/(protected)/settings/data-and-storage": [17,[2,3]],
		"/(protected)/settings/logout": [18,[2,3]],
		"/(protected)/settings/notifications": [19,[2,3]]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: universal_hooks.reroute || (() => {}),
	transport: universal_hooks.transport || {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';