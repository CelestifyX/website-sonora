<script lang="ts">
	import { accounts } from '$lib/mock/accounts.svelte';
	import { providers } from '$lib/mock/catalog';
	import { menu, type Sheet } from '$lib/mock/menu.svelte';
	import { route } from '$lib/mock/route.svelte';
	import Control from './Control.svelte';
	import Downloads from './Downloads.svelte';

	let {
		left,
		ontoggle,
		right = $bindable()
	}: {
		/** Whether the left sidebar shows, docked beside the page or laid over it. */
		left: boolean;
		ontoggle: () => void;
		right: boolean;
	} = $props();

	/** The width of the account menu, the desktop's `Picker::REGULAR`. */
	const ACCOUNT_WIDTH = 190;

	const at = $derived(route.now);
	const listing = $derived(
		at.screen === 'album' ||
			at.screen === 'playlist' ||
			at.screen === 'history' ||
			(at.screen === 'library' && (at.tab ?? 'Songs') === 'Songs')
	);
	const carded = $derived(at.screen === 'library' && (at.tab ?? 'Songs') !== 'Songs');
	const filed = $derived(listing || carded);
	const refreshes = $derived(
		at.screen !== 'search' && at.screen !== 'settings' && at.screen !== 'equalizer'
	);

	let turning = $state(false);
	let settle = 0;

	function refresh() {
		clearTimeout(settle);
		turning = true;
		settle = setTimeout(() => (turning = false), 900);
	}

	/**
	 * The account menu: the signed-in services to switch between, a way to manage them, then
	 * Recents and Settings, which the sidebar leaves out.
	 */
	const accountSheet = (): Sheet => ({
		width: ACCOUNT_WIDTH,
		items: [
			...providers
				.filter((one) => accounts.stored(one.glyph))
				.map((one) => ({
					id: `account-${one.glyph}`,
					label: one.name,
					icon: one.glyph,
					selected: accounts.active === one.glyph,
					onclick: () => accounts.use(one.glyph)
				})),
			{ id: 'account-services', separator: true },
			{
				id: 'account-manage',
				label: 'Manage accounts',
				icon: 'user-round',
				onclick: () => route.go({ screen: 'settings', tab: 'Providers' })
			},
			{ id: 'account-pages', separator: true },
			{
				id: 'account-history',
				label: 'Recents',
				icon: 'rotate-ccw-clock',
				onclick: () => route.go({ screen: 'history' })
			},
			{
				id: 'account-settings',
				label: 'Settings',
				icon: 'settings',
				onclick: () => route.go({ screen: 'settings' })
			}
		]
	});
</script>

<div class="bar">
	<div class="leading">
		<Control
			icon={left ? 'panel-left-close' : 'panel-left-open'}
			title="Toggle sidebar"
			small
			onclick={ontoggle}
		/>
	</div>

	<div class="middle">
		<div class="history">
			<Control
				icon="chevron-left"
				title="Back"
				size={28}
				disabled={!route.behind}
				onclick={() => route.back()}
			/>
			<Control
				icon="chevron-right"
				title="Forward"
				size={28}
				disabled={!route.ahead}
				onclick={() => route.forward()}
			/>
			{#if refreshes}
				<span class="refresh" class:turning>
					<Control icon="refresh-cw" title="Refresh" size={28} onclick={refresh} />
				</span>
			{/if}
		</div>

		<Downloads />

		{#if filed}
			<div class="tools">
				{#if carded && at.tab === 'Playlists'}
					<Control icon="plus" title="New playlist" small />
				{/if}
				{#if carded}
					<Control icon="list" title="List view" small />
				{/if}
				<Control icon="funnel" title="Filters" small tint="muted" />
				<Control icon="arrow-up-down" title="Sort" small tint="muted" />
				<Control icon="search" title="Search" small />
			</div>
			<span class="rule"></span>
		{/if}
	</div>

	<div class="trail">
		<Control
			icon="circle-user-round"
			title="Account"
			small
			selected={menu.owner === 'account'}
			onclick={(event) =>
				menu.from(event.currentTarget as Element, 'account', accountSheet, { align: 'end' })}
		/>
		<Control
			icon={right ? 'panel-right-close' : 'panel-right-open'}
			title="Show or hide lyrics and queue"
			small
			onclick={() => (right = !right)}
		/>
	</div>
</div>

<style>
	.bar {
		display: flex;
		flex: none;
		align-items: center;
		height: 36px;
		background: var(--m-background);
		border-bottom: 1px solid var(--m-title-bar-border);
	}

	/* the sidebar toggle sits as close to the history buttons as they sit to each other */
	.leading {
		display: flex;
		flex: none;
		align-items: center;
		padding-left: 10.5px;
		padding-right: 3.5px;
	}

	.middle {
		display: flex;
		flex: 1;
		min-width: 0;
		align-items: center;
		gap: 3.5px;
		padding-right: 3.5px;
	}

	.history,
	.tools,
	.trail {
		display: flex;
		align-items: center;
		gap: 3.5px;
	}

	.refresh {
		display: flex;
	}

	.refresh.turning :global(svg) {
		animation: turn 900ms cubic-bezier(0.33, 1, 0.68, 1);
	}

	@keyframes turn {
		to {
			transform: rotate(360deg);
		}
	}

	.history {
		flex: 1;
		min-width: 0;
	}

	.tools {
		flex: none;
		min-width: 0;
		justify-content: flex-end;
	}

	/* sets the account and sidebar segment apart from the controls of the page */
	.rule {
		flex: none;
		width: 1px;
		height: 13px;
		margin: 0 3.5px;
		background: var(--m-border);
	}

	.trail {
		flex: none;
		padding-right: 10.5px;
	}
</style>
