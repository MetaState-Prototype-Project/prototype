<script lang="ts">
	import { Table } from "$lib/ui";

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
</script>


<section>
    <Table
    class="mb-7"
    tableData= {mappedData}
    withSelection= {true}
    {handlePreviousPage}
    {handleNextPage}
    />

    <Table
    tableData= {mappedData}
    withSelection= {true}
    {handlePreviousPage}
    {handleNextPage}
    />
</section>
