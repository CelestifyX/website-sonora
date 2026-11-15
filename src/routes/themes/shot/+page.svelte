<script lang="ts">
	import { onMount } from 'svelte';
	import AppMock from '$lib/components/mock/AppMock.svelte';
	import { variant } from '$lib/data/themes';
	import { route, type Stop } from '$lib/mock/route.svelte';
	import { settings } from '$lib/mock/settings.svelte';
	import { addPalette } from '$lib/mock/theme';
	import { check } from '$lib/theme-file';

	/**
	 * The handle the theme screenshot script drives the mock through. It lives on `window` so a
	 * headless browser can load a theme file it was handed without the site knowing about it.
	 */
	type Shot = {
		/**
		 * Checks a theme's files the way the gallery does and returns each variant's file name and
		 * title, in the order Sonora lists them.
		 */
		load(id: string, entries: [string | null, string][]): [string, string][];
		/** Paints the mock with an installed variant or a built-in theme. */
		use(title: string): void;
		go(stop: Stop): void;
	};

	let ready = $state(false);

	onMount(() => {
		settings.motion = 'Never';
		settings.ambient = false;
		const shot: Shot = {
			load(id, entries) {
				const checked = check(id, entries, (reason) => {
					throw new Error(reason);
				});
				return checked.map(([stem, file]) => {
					const painted = variant(stem ?? id, file);
					addPalette(painted.title, painted.colors);
					return [stem ?? id, painted.title] as [string, string];
				});
			},
			use(title) {
				settings.adaptive = false;
				settings.theme = title;
			},
			go(stop) {
				route.go(stop);
			}
		};
		(window as unknown as { sonoraShot: Shot }).sonoraShot = shot;
		ready = true;
	});
</script>

<svelte:head>
	<title>Theme screenshot · Sonora</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="shot" data-ready={ready || undefined}>
	<AppMock />
</div>

<style>
	.shot {
		display: flex;
		justify-content: center;
		padding: 24px 0;
	}

	.shot > :global(*) {
		width: 1170px;
		flex: none;
	}
</style>
