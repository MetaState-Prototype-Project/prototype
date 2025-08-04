<script lang="ts" generics="T">
	import { Checkbox } from '$lib/ui';
	import { cn } from '$lib/utils';
	import {
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell
	} from 'flowbite-svelte';
	import {
		ArrowDownOutline,
		ArrowUpOutline,
		ChevronLeftOutline,
		ChevronRightOutline
	} from 'flowbite-svelte-icons';
	import { type Snippet, onMount } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type TableCell<T = unknown> =
		| { type: 'image'; value: string; width?: number }
		| {
				type: 'text';
				value: string | number;
				width?: number;
				sortable?: string;
		  }
		| {
				type: 'link';
				value: string | number;
				width?: number;
				link?: string;
				sortable?: string;
		  }
		| {
				type: 'snippet';
				snippet?: Snippet<[T]>;
				value: string | number | object;
				width?: number;
				sortable?: string;
		  }
		| {
				type: string;
				value: string | number;
				width?: number;
				sortable?: string;
		  }
		| { value: string | number; width?: number; sortable?: string };

	interface ITableProps extends HTMLAttributes<HTMLElement> {
		tableData: Record<string, TableCell>[];
		handleNextPage?: () => Promise<void>;
		handlePreviousPage?: () => Promise<void>;
		goToPage?: (page: number) => Promise<void>;
		handleSelectedRow?: (index: number) => void;
		selectedRow?: number;
		withSelection?: boolean;
		headerHeight?: number;
		onMutate?: () => Promise<void> | void;
		currentPage?: number;
		totalPages?: number;
		totalItems?: number;
		pageSize?: number;
		isLoading?: boolean;
		withPagination?: boolean;
		onSort?: (column: string) => void;
		sortBy?: string;
		sortOrder?: 'asc' | 'desc';
	}

	let {
		tableData = [],
		handleNextPage,
		handlePreviousPage,
		handleSelectedRow,
		goToPage,
		selectedRow = $bindable(),
		withSelection = false,
		headerHeight = 76,
		onMutate,
		currentPage = 1,
		totalPages = 1,
		totalItems = 0,
		pageSize = 20,
		isLoading = false,
		withPagination = true,
		onSort,
		sortBy,
		sortOrder,
		...restProps
	}: ITableProps = $props();

	selectedRow = undefined;

	let checkAll = $state(false);
	let checkItems = $derived<boolean[]>(tableData.map(() => false));

	function toggleCheckAll(checked: boolean) {
		checkAll = checked;
		checkItems = checkItems.map(() => checked);
	}

	function toggleCheckItem(i: number, checked: boolean) {
		checkItems[i] = checked;

		const all = checkItems.every(Boolean);
		if (checkAll !== all) {
			checkAll = all;
		}
	}

	let tableContainer: HTMLDivElement | null = null;
	let tableHeight = $state(0);
	let isScrollable = $state(false);

	function checkIfScrollable() {
		if (!tableContainer) return false;
		return tableContainer.scrollHeight > tableHeight;
	}

	function generatePageNumbers(current: number, total: number): (number | string)[] {
		const pages: (number | string)[] = [];
		const maxVisiblePages = 5;

		if (total <= maxVisiblePages) {
			for (let i = 1; i <= total; i++) {
				pages.push(i);
			}
		} else {
			pages.push(1);

			let startPage = Math.max(2, current - 1);
			let endPage = Math.min(total - 1, current + 1);

			if (startPage > 2) {
				pages.push('...');
			}

			for (let i = startPage; i <= endPage; i++) {
				pages.push(i);
			}

			if (endPage < total - 1) {
				pages.push('...');
			}

			if (total > 1) {
				pages.push(total);
			}
		}

		return pages;
	}

	onMount(() => {
		isScrollable = checkIfScrollable();
		const resizeObserver = new ResizeObserver(() => {
			isScrollable = checkIfScrollable();
		});
		if (tableContainer) {
			resizeObserver.observe(tableContainer);
		}
		return () => {
			if (tableContainer) {
				resizeObserver.unobserve(tableContainer);
			}
		};
	});

	const tableHeadings = $derived(tableData.length > 0 ? Object.keys(tableData[0]) : []);

	const tableWidths = $derived.by(() => {
		if (!tableData || tableData.length === 0) return {};
		const headings = Object.keys(tableData[0]);
		const widthConfig: Record<string, string> = {};

		const totalWeight = headings.reduce((sum, key) => {
			const cell = tableData[0][key];
			if ('type' in cell && cell.type === 'image') {
				widthConfig[key] = '80px'; // fixed image width
				return sum;
			}

			const weight = 'width' in cell && cell.width ? cell.width : 1;
			return sum + weight;
		}, 0);

		for (const key of headings) {
			const cell = tableData[0][key];

			if ('type' in cell && cell.type === 'image') {
				widthConfig[key] = '80px'; // fixed image width
				continue;
			}

			const weight = 'width' in cell && cell.width ? cell.width : 1;
			const percent = (weight / totalWeight) * 100;
			widthConfig[key] = `${percent}%`;
		}

		return widthConfig;
	});
</script>

<Table
	class={cn(
		['text-black-700 relative w-full table-fixed text-left text-sm', restProps.class].join(' ')
	)}
>
	<TableHead class="sticky top-0 h-[var(--table-header-height)] bg-white">
		{#if withSelection}
			<TableHeadCell class="wide:px-5 w-[48px] max-w-[48px] min-w-[48px] rounded-l-2xl p-4">
				<Checkbox checked={checkAll} onchange={(e) => toggleCheckAll(e as boolean)} />
			</TableHeadCell>
		{/if}
		{#each tableHeadings as tableHeading, i}
			{@render HeadCell(tableHeading, i)}
		{/each}
		{#if isScrollable}
			<TableHeadCell class="w-3 rounded-r-2xl p-0 opacity-0"></TableHeadCell>
		{/if}
	</TableHead>
</Table>
<div
	class="{withPagination ? 'table-height' : 'table-height-no-pagination'} z-20 overflow-y-auto"
	style:--header-height="{headerHeight}px"
	bind:this={tableContainer}
	bind:clientHeight={tableHeight}
>
	<Table
		class={cn(
			[
				'text-black-700 relative w-full table-fixed border-separate border-spacing-y-2 text-left text-sm',
				restProps.class
			].join(' ')
		)}
	>
		<TableBody>
			{#each tableData as data, i}
				<TableBodyRow
					onclick={() => {
						selectedRow = i;
						handleSelectedRow && handleSelectedRow(i);
					}}
					class="hover:bg-gray w-full bg-white select-none
                        {selectedRow === i && 'bg-gray!'}"
				>
					{#if withSelection}
						<th class="wide:px-5 w-[48px] max-w-[48px] min-w-[48px] rounded-l-2xl p-4">
							<Checkbox
								checked={checkItems[i]}
								onchange={(e) => toggleCheckItem(i, e as boolean)}
							/>
						</th>
					{/if}
					{#each tableHeadings as field, j}
						{@render BodyCell(data, field, j)}
					{/each}
				</TableBodyRow>
			{/each}
		</TableBody>
	</Table>
</div>

{#snippet HeadCell(heading: string, i: number)}
	{@const cellData = tableData[0]?.[heading]}
	{@const isSortable = cellData && 'sortable' in cellData && cellData.sortable}
	<TableHeadCell
		class="wide:text-base font-roboto text-black-700 p-0 text-xs font-bold normal-case
            {i === 0 && !withSelection && 'rounded-l-2xl'}
            {i === tableHeadings.length - 1 && !isScrollable && 'rounded-r-2xl'}
            "
		style="width: {tableWidths[heading]}; min-width: {tableWidths[heading]}"
	>
		{#if heading.startsWith('_') || heading === ''}
			<!-- Non-sortable empty column -->
			<div class="p-2"></div>
		{:else if isSortable && onSort}
			<button
				class="flex w-full items-center justify-between gap-2 p-2 text-left hover:bg-white/5 focus:bg-white/5 focus:outline-none"
				onclick={() => cellData.sortable && onSort?.(cellData.sortable)}
				disabled={!onSort}
			>
				<span class="truncate text-xs">{heading}</span>
				<div class="flex flex-col items-center justify-center">
					{#if sortBy === cellData.sortable}
						{#if sortOrder != 'asc'}
							<ArrowUpOutline class="h-5 w-5 text-gray-500" />
						{:else}
							<ArrowDownOutline class="h-5 w-5 text-gray-500" />
						{/if}
					{:else}
						<div class="flex flex-col">
							<ArrowUpOutline class="-mb-2 h-3 w-3" />
							<ArrowDownOutline class="h-3 w-3" />
						</div>
					{/if}
				</div>
			</button>
		{:else}
			<!-- Non-sortable column -->
			<div class="p-2">
				<span class="truncate">{heading}</span>
			</div>
		{/if}
	</TableHeadCell>
{/snippet}

{#snippet BodyCell(data: Record<string, TableCell>, field: string, i: number)}
	<TableBodyCell
		class="wide:text-base font-roboto text-black-700 overflow-hidden p-2 text-xs font-normal text-ellipsis
            {i === 0 && !withSelection && 'rounded-s-2xl pl-6'}
            {i === Object.keys(data).length - 1 && 'rounded-e-2xl'}
        "
		style="width: {tableWidths[field]}"
	>
		{#if 'snippet' in data[field]}
			{@const snippet = data[field].snippet}
			{@const value = data[field].value as T}
			{#if snippet}
				{@render snippet(value)}
			{/if}
		{:else if 'type' in data[field] && data[field].type === 'image' && typeof data[field].value === 'string'}
			<!-- needs to be change -->
			<img
				class="h-12 w-12 rounded-lg border-[0.5px] border-gray-700 object-cover [filter:drop-shadow(0_0_5px_rgba(255,255,255,1))]"
				src={'https://picsum.photos/200'}
				alt=""
			/>
		{:else if 'type' in data[field] && data[field].type === 'link'}
			<a href={data[field].value as string} target="_blank" rel="noopener noreferrer">
				{data[field].value}
			</a>
		{:else if 'type' in data[field] && data[field].type === 'text'}
			<span class="whitespace-nowrap">{data[field].value}</span>
		{:else}
			<span>{data[field].value}</span>
		{/if}
	</TableBodyCell>
{/snippet}

<!-- PAGINATION -->
{#if withPagination}
	<div
		class="sticky bottom-0 z-10 flex h-[var(--pagination-height)] items-center justify-between rounded-2xl bg-white p-3"
	>
		<p class="small text-black-700">
			Showing {(currentPage - 1) * pageSize + 1} - {Math.min(
				currentPage * pageSize,
				totalItems
			)} of {totalItems}
		</p>
		<div class="flex items-center gap-2">
			<!-- Custom Pagination -->
			<div class="border-primary-900 flex items-center rounded-lg border bg-white">
				<!-- Previous Button -->
				<button
					class=" text-black-700 hover:bg-black-300 flex h-8 w-10 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					onclick={handlePreviousPage}
					disabled={currentPage <= 1 || isLoading}
				>
					<ChevronLeftOutline class="h-8 w-8" />
				</button>

				<!-- Page Numbers -->
				{#each generatePageNumbers(currentPage, totalPages) as pageNum}
					{#if pageNum === '...'}
						<span class="text-black-700 flex h-8 w-10 items-center justify-center"
							>...</span
						>
					{:else}
						<button
							class="outline-primary-900 flex h-8 w-10 items-center justify-center transition-colors
                                {currentPage === pageNum
								? ' text-black-700 bg-white'
								: '  text-black-700 hover:bg-white'}"
							onclick={() =>
								typeof pageNum === 'number' ? goToPage?.(pageNum) : undefined}
							disabled={isLoading}
						>
							{pageNum}
						</button>
					{/if}
				{/each}

				<!-- Next Button -->
				<button
					class="text-black-700 hover:bg-black-300 flex h-8 w-10 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					onclick={handleNextPage}
					disabled={currentPage >= totalPages || isLoading}
				>
					<ChevronRightOutline class="h-8 w-8" />
				</button>
			</div>
		</div>
	</div>
{/if}

<!--
@component
@name Table
@description A table component that displays data in a tabular format with pagination and selection options.

### Comments
    - You have to pass the header height as a prop to the table component or it won't work properly.
    - If a heading starts with an underscore (`_`), it will be rendered as an empty string.

## Usage
```svelte
    import Table from "$lib/ui/Table/Table.svelte";
    import { type Snippet } from "svelte";

    const data = // fetch data from your server or use a static array

    const mappedData = $derived(
        data.map((row) => {
            const normalizedRow = normalizeDataRow(row);
            return {
                Image: {
                    type: "image",
                    value: normalizedRow.image,
                },
                "Material Name": {
                    type: "text",
                    value: normalizedRow.name,
                    width: 1,
                    sortable: "name",
                },
                Description: {
                    type: "text",
                    value: normalizedRow.description,
                    width: 2,
                    sortable: "description",
                },
                "Product Id": {
                    type: "snippet",
                    value: normalizedRow.status,
                    snippet: ActiveStatus,
                    width: 1,
                    sortable: "status",
                },
                "Smart Contract": {
                    type: "text",
                    value: normalizedRow.smartContract,
                    width: 1,
                    sortable: "smartContract",
                },
                Link: {
                    type: "link",
                    link: normalizedRow.ledgerLink,
                    value: normalizedRow.ledgerLink.replace(/^https?:\/\//, ""),
                    width: 0.75,
                },
            };
        }),
    );

    const pages = [
        { name: "1", href: "#" },
        { name: "2", href: "#" },
        { name: "3", href: "#" },
    ];

    let headerHeight = $state(0);

    const handleNextPage = async () => {
        // Handle next page logic here
    };

    const handlePreviousPage = async () => {
        // Handle previous page logic here
    };
    </script>

    <header bind:clientHeight={headerHeight}>
        Header stuff
    </header>

    <Table
        tableData={mappedData}
        {handleNextPage}
        {handlePreviousPage}
        {pages}
        withSelection
        {headerHeight}
    />

    {#snippet ActiveStatus(value: string)}
        <Badge
            class="uppercase"
            color={value === "active" ? "green" : "red"}
            isDismissable={false}>{value}</Badge
        >
    {/snippet}
    ```

### Props
    tableHeadings: string[] - The headings for the table columns.
    tableData: Record<string, TableCell>[] - The data to be displayed in the table.
    handleNextPage: () => Promise<void> - Function to handle pagination next button click.
    handlePreviousPage: () => Promise<void> - Function to handle pagination previous button click.
    selectedRow: string - The currently selected row.
    pages: { name: string; href: string }[] - The pagination pages.
    withSelection?: boolean - Whether to show selection checkboxes or not.
    headerHeight?: number - The height of the table header.

 -->

<style>
	:root {
		--table-header-height: 52px;
		--pagination-height: 58px;
	}

	.table-height {
		height: calc(
			var(--height-dash) - var(--spacing-block-card) * 2 - var(--header-height) -
				var(--table-header-height) - var(--pagination-height) - 3px
		);
	}

	.table-height-no-pagination {
		height: calc(
			var(--height-dash) - var(--spacing-block-card) * 2 - var(--header-height) -
				var(--table-header-height) - 3px
		);
	}
	@media (min-width: 1920px) {
		:root {
			--height-dash: var(--height-dash-wide);
		}
	}
</style>
