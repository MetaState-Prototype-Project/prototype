import { type SVGAttributes } from 'svelte/elements';

export interface ISvgProps extends SVGAttributes<SVGElement> {
	size?: number | string;
	color?: string;
}
