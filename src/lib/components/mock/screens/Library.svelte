<script lang="ts">
	import { menu } from '$lib/mock/menu.svelte';
	import { albumMenu, artistMenu, playlistMenu } from '$lib/mock/menus';
	import { albums, clock, records } from '$lib/mock/album';
	import { artists, favorites, libraryColumns, localTracks, playlists } from '$lib/mock/screens';
	import { player } from '$lib/mock/player.svelte';
	import { route } from '$lib/mock/route.svelte';
	import Card from '../Card.svelte';
	import Control from '../Control.svelte';
	import PageHero from '../PageHero.svelte';
	import Table from '../Table.svelte';

	let { tab = 'Songs' }: { tab?: string } = $props();

	const CARD = 145;
	const GAP = 33;

	/** The saved songs with the local files mixed in, as the desktop merges them into one library. */
	const songs = [
		...favorites,
		...localTracks.filter((track) => !favorites.some((saved) => saved.id === track.id))
	];
	const shown = albums;
	const people = artists;
	const lists = playlists;
	const total = $derived(songs.reduce((sum, track) => sum + track.length, 0));
	const mine = $derived(songs.some((track) => track.id === player.id));
	const holding = $derived(mine && player.playing);
</script>

<div class="screen" class:listing={tab === 'Songs'}>
	{#if tab === 'Songs'}
		<div class="gutter">
			<PageHero
				title="Songs"
				eyebrow="Your Library"
				fallback="music"
				meta={[`${songs.length} songs`, clock(total)]}
			>
				{#snippet actions()}
					<Control
						variant="filled"
						icon={holding ? 'pause' : 'play'}
						label={holding ? 'Pause' : mine ? 'Resume' : 'Play'}
						onclick={() => {
							if (holding) player.pause();
							else if (mine) player.resume();
							else player.select(songs[0].id);
						}}
					/>
					<Control
						variant="outline"
						icon="shuffle"
						title="Shuffle"
						onclick={() => player.playShuffled()}
					/>
				{/snippet}
			</PageHero>
		</div>
		<Table columns={libraryColumns} rows={songs} />
	{:else if tab === 'Albums'}
		<div class="grid" style:column-gap="{GAP}px">
			{#each shown as entry (entry.id)}
				<Card
					tile={CARD}
					flat
					weight={600}
					title={entry.title}
					underline
					meta="{entry.released} · {entry.artist}"
					cover={entry.cover}
					onplay={() => player.select((records.get(entry.id) ?? [])[0]?.id ?? player.id)}
					onpress={() => route.go({ screen: 'album', id: entry.id })}
					oncontext={(event: MouseEvent) =>
						menu.at(event, `album-${entry.id}`, () => albumMenu(entry.id))}
				/>
			{/each}
		</div>
	{:else if tab === 'Artists'}
		<div class="grid" style:column-gap="{GAP}px">
			{#each people as artist (artist.id)}
				<Card
					tile={CARD}
					flat
					circle
					weight={600}
					fallback="user-round"
					cover={artist.image}
					title={artist.name}
					meta="Artist"
					onpress={() => route.go({ screen: 'artist', id: artist.id })}
					oncontext={(event: MouseEvent) =>
						menu.at(event, `artist-${artist.id}`, () => artistMenu(artist.id))}
				/>
			{/each}
		</div>
	{:else}
		<div class="grid" style:column-gap="{GAP}px">
			{#each lists as list (list.id)}
				<Card
					tile={CARD}
					flat
					weight={600}
					fallback="list-music"
					cover={list.cover}
					title={list.name}
					meta={list.owner}
					onpress={() => route.go({ screen: 'playlist', id: list.id })}
					oncontext={(event: MouseEvent) =>
						menu.at(event, `playlist-${list.id}`, () => playlistMenu(list.id))}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.screen {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		padding: 24px;
		background: var(--m-background);
		overflow-x: hidden;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--m-muted-foreground) 45%, transparent) transparent;
	}

	.screen.listing {
		padding: 24px 0;
	}

	.gutter {
		padding: 0 24px;
		flex: none;
	}

	.grid {
		display: flex;
		width: 100%;
		flex-wrap: wrap;
		row-gap: 21px;
		flex: none;
	}
</style>
