<script lang="ts">
	import { LiveDataFlow, Logs } from '$lib/fragments';
	import { Table } from '$lib/ui';

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

	let currentSelectedEventIndex = $state(-1);

	const events = [
		{
			timestamp: new Date(),
			action: 'upload',
			message: 'msg_123',
			to: 'alice.vault.dev'
		},
		{
			timestamp: new Date(),
			action: 'fetch',
			message: 'msg_124',
			from: 'bob.vault.dev'
		},
		{
			timestamp: new Date(),
			action: 'webhook',
			to: 'Alice',
			from: 'Pic'
		}
	];
</script>

<!-- <section>
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
</section> -->

<section class="flex gap-2">
	<LiveDataFlow events={[
		{ id: "1", from: "Alice", to: "Pictique", vaultName: "Alice.Vault.Dev", imageSrc: "" },
		{ id: "2", from: "Pictique", to: "Bob",vaultName: "Pictique.Vault.Dev", imageSrc: "" },
		{ id: "3", from: "Bob", to: "", vaultName: "Bob.Vault.Dev", imageSrc: "" },
	]}/>
	<Logs class="w-[40%]" {events} bind:activeEventIndex={currentSelectedEventIndex} />
</section>
