<script lang="ts">
	import { catalogue, nav, type NavEntry } from '$lib/mock/album';
	import { library } from '$lib/mock/library.svelte';
	import { menu } from '$lib/mock/menu.svelte';
	import { albumMenu, artistMenu, playlistMenu, trackMenu } from '$lib/mock/menus';
	import { route } from '$lib/mock/route.svelte';
	import Card from './Card.svelte';
	import Icon from './Icon.svelte';

	let folded = $state(false);

	const at = $derived(route.now);

	/** Whether the page on screen belongs to `entry`, the way the desktop's `same_section` asks. */
	const inside = (entry: NavEntry) =>
		at.screen === entry.screen && (!entry.tab || (at.tab ?? 'Songs') === entry.tab);

	const here = (entry: { to: { screen: string; id: string } }) =>
		at.screen === entry.to.screen && at.id === entry.to.id;
</script>

{#snippet row(entry: NavEntry)}
	<button
		type="button"
		class="row"
		class:on={inside(entry)}
		onclick={() => route.go({ screen: entry.screen, tab: entry.tab })}
	>
		<Icon name={entry.icon} />
		<span class="label">{entry.label}</span>
	</button>
{/snippet}

<nav class="sidebar">
	{#each nav.top as entry (entry.label)}
		{@render row(entry)}
	{/each}

	<span class="heading">Library</span>
	{#each nav.library as entry (entry.label)}
		{@render row(entry)}
	{/each}

	<div class="group">
		<button type="button" class="fold" onclick={() => (folded = !folded)}>
			<Icon name={folded ? 'chevron-right' : 'chevron-down'} size={12} />
			<span class="eyebrow">Pinned</span>
		</button>
		{#if !folded}
			<button type="button" class="sort" title="Sort"><Icon name="arrow-up-down" /></button>
		{/if}
	</div>

	{#if !folded}
		{#each library.pins as entry (entry.id)}
			<span class="pin" class:here={here(entry)}>
				<Card
					flat
					title={entry.title}
					meta={entry.kind}
					cover={entry.cover}
					fallback={entry.icon}
					tint={here(entry) ? 'var(--m-foreground)' : 'var(--m-muted-foreground)'}
					circle={entry.round ?? false}
					onplay={() => route.go(entry.to)}
					onpress={() => route.go(entry.to)}
					oncontext={(event: MouseEvent) =>
						menu.at(event, `pin-${entry.id}`, () =>
							entry.kind === 'Song' && catalogue.has(entry.id)
								? trackMenu(catalogue.get(entry.id)!)
								: entry.kind === 'Album'
									? albumMenu(entry.id)
									: entry.kind === 'Artist'
										? artistMenu(entry.id)
										: playlistMenu(entry.id)
						)}
				/>
			</span>
		{/each}
	{/if}
</nav>

<style>
	.sidebar {
		display: flex;
		flex: none;
		flex-direction: column;
		gap: 3.5px;
		width: var(--m-left, 195px);
		padding: 10.5px;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--m-muted-foreground) 45%, transparent) transparent;
		background: var(--m-sidebar);
		border-right: 1px solid var(--m-sidebar-border);
	}

	.row {
		display: flex;
		flex: none;
		align-items: center;
		gap: 8.75px;
		height: 32px;
		padding: 0 12px;
		border: 0;
		border-radius: var(--m-radius);
		background: none;
		color: var(--m-muted-foreground);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.row:hover,
	.row.on {
		background: var(--m-sidebar-accent);
	}

	.row.on {
		color: var(--m-foreground);
	}

	.label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* the heading over the library rows, starting where their glyphs start */
	.heading {
		display: flex;
		flex: none;
		align-items: center;
		height: 26px;
		margin-top: 8px;
		padding-left: 12px;
		color: var(--m-muted-foreground);
		font-size: 12px;
		font-weight: 500;
	}

	.group {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: space-between;
		height: 26px;
		margin: 16px 0 2px;
		padding: 0 3.5px 0 7px;
	}

	.fold {
		display: flex;
		flex: 1;
		min-width: 0;
		align-items: center;
		gap: 3.5px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--m-muted-foreground);
		font: inherit;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}

	.fold .eyebrow {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sort {
		display: flex;
		width: 26px;
		height: 26px;
		flex: none;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 0;
		border-radius: var(--m-radius);
		background: none;
		color: var(--m-muted-foreground);
		cursor: pointer;
	}

	.sort:hover {
		background: var(--m-secondary-hover);
		color: var(--m-foreground);
	}

	.pin {
		display: flex;
		flex: none;
		border-radius: var(--m-radius);
		color: var(--m-muted-foreground);
	}

	.pin.here {
		background: var(--m-sidebar-accent);
		color: var(--m-foreground);
	}

	.pin:hover {
		background: var(--m-sidebar-accent);
	}
</style>
