export const load = ({ params }) => {
	console.log('+page.ts load called with params:', params);
	return {
		namespace: params.namespace,
		service: params.service
	};
}; 