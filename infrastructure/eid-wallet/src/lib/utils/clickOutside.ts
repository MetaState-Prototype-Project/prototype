/** Dispatch event on click outside of node */
export const clickOutside = (node: HTMLElement) => {
	const handleClick = (event: Event) => {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		if (node && !node.contains(event.target) && !event.defaultPrevented) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			node.dispatchEvent(new CustomEvent('click_outside', node));
		}
	};

	document.addEventListener('click', handleClick, true);

	return {
		destroy() {
			document.removeEventListener('click', handleClick, true);
		}
	};
};
