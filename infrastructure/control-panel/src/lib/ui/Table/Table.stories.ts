import Table from './Table.svelte';

export default {
	title: 'UI/Table',
	component: Table,
	tags: ['autodocs'],
	render: <T>(args: { Component: Table<T> }) => ({
		Component: Table,
		props: args
	})
};
const handlePreviousPage = async () => {
	alert('Previous btn clicked. Make a call to your server to fetch data.');
};
const handleNextPage = async () => {
	alert('Next btn clicked. Make a call to your server to fetch data.');
};
const tableHeadings = [
	'Image',
	'Material Name',
	'Description',
	'Product ID',
	'Smart Contract'
	// "Ledger Link",
];
const pages = [
	{ name: '1', href: '#' },
	{ name: '2', href: '#' },
	{ name: '3', href: '#' }
];
const tableData = [
	{
		image: 'https://example.com/image1.jpg',
		name: 'Material 1',
		description: 'Description of Material 1',
		productId: '12345',
		smartContract: '0x1234567890abcdef',
		ledgerLink: 'https://example.com/ledger1'
	},
	{
		image: 'https://example.com/image2.jpg',
		name: 'Material 2',
		description: 'Description of Material 2',
		productId: '67890',
		smartContract: '0xabcdef1234567890',
		ledgerLink: 'https://example.com/ledger2'
	},
	{
		image: 'https://example.com/image3.jpg',
		name: 'Material 3',
		description: 'Description of Material 3',
		productId: '54321',
		smartContract: '0x0987654321fedcba',
		ledgerLink: 'https://example.com/ledger3'
	},
	{
		image: 'https://example.com/image4.jpg',
		name: 'Material 4',
		description: 'Description of Material 4',
		productId: '11223',
		smartContract: '0xabcdef0987654321',
		ledgerLink: 'https://example.com/ledger4'
	},
	{
		image: 'https://example.com/image5.jpg',
		name: 'Material 5',
		description: 'Description of Material 5',
		productId: '44556',
		smartContract: '0x123456abcdef7890',
		ledgerLink: 'https://example.com/ledger5'
	}
];

const mappedData = tableData.map((row) => {
	return {
		rowOne: {
			type: 'image',
			value: row.image
		},
		rowTwo: {
			type: 'text',
			value: row.name
		},
		rowThree: {
			type: 'text',
			value: row.description
		},
		rowFour: {
			type: 'text',
			value: row.productId
		},
		rowFive: {
			type: 'text',
			value: row.smartContract
		}
		// rowSix: {
		//     type: "snippet",
		//     snippet: BadgeCell,
		//     value:
		//         row.ledgerLink,
		// },
	};
});

export const Primary = {
	args: {
		tableHeadings,
		tableData: mappedData,
		withSelection: true,
		pages,
		handlePreviousPage,
		handleNextPage
	}
};
