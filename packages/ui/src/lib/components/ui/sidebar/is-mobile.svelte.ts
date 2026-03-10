const MOBILE_BREAKPOINT = 768;

export class IsMobile {
	#current = $state(false);

	constructor(breakpoint: number = MOBILE_BREAKPOINT) {
		$effect(() => {
			const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);

			const onChange = () => {
				this.#current = mql.matches;
			};

			// Initialize
			onChange();

			mql.addEventListener('change', onChange);
			return () => mql.removeEventListener('change', onChange);
		});
	}

	get current() {
		return this.#current;
	}
}
