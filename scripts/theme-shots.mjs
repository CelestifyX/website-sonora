#!/usr/bin/env node
/**
 * Screenshots community themes in the app mock and measures how readable their text is.
 *
 *   node scripts/theme-shots.mjs shoot --url http://localhost:4173 --out shots src/lib/themes/rose.json
 *   node scripts/theme-shots.mjs markdown --report shots/report.json --base https://example.com/shots
 *
 * `shoot` takes theme files or theme folders, named the way `src/lib/themes` names them, and
 * renders every variant on the `/themes/shot` page of a running copy of the site. It writes the
 * screenshots, zoomed crops and a `report.json` that lists every piece of text below 4.5:1.
 * `markdown` turns that report into the pull request comment, with images under `--base`.
 * Set `CHROMIUM` to use a browser binary other than the one Playwright installed.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';

/** Contrast below this is unreadable for any text. */
const UNREADABLE = 3;
/** WCAG AA for body text, which every label in Sonora is. */
const LOW = 4.5;
/** How many of the worst spots each variant gets a zoom of. */
const WORST_ZOOMS = 3;
/** What each fixed zoom is called in the comment. */
const LABELS = {
	table: 'Track list',
	hero: 'Album header',
	player: 'Player bar',
	lyrics: 'Lyrics',
	menu: 'Context menu',
	sidebar: 'Sidebar',
	queue: 'Queue',
	settings: 'Settings'
};
/** Room left around a zoomed spot, in CSS pixels. */
const PAD = 28;

/** Reads a theme path into the `[file name | null, text][]` entries the page's `load` takes. */
async function entriesOf(path) {
	if (path.endsWith('.json'))
		return [basename(path, '.json'), [[null, await readFile(path, 'utf8')]]];
	const names = (await readdir(path)).filter((name) => name.endsWith('.json')).sort();
	const entries = await Promise.all(
		names.map(async (name) => [basename(name, '.json'), await readFile(join(path, name), 'utf8')])
	);
	return [basename(path.replace(/\/+$/, '')), entries];
}

async function shoot(args) {
	const { values, positionals } = parseArgs({
		args,
		allowPositionals: true,
		options: { url: { type: 'string' }, out: { type: 'string' } }
	});
	if (!values.url || !values.out || !positionals.length) {
		throw new Error('shoot needs --url, --out and at least one theme path');
	}
	const { chromium } = await import('playwright');
	const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 820 },
		deviceScaleFactor: 2,
		reducedMotion: 'reduce'
	});
	// a dev server compiles the mock on the first visit, which can take longer than the default
	context.setDefaultTimeout(90_000);
	const report = { themes: [] };
	try {
		for (const path of positionals) {
			const [id, entries] = await entriesOf(path);
			const theme = { id, variants: [], error: null };
			report.themes.push(theme);
			const page = await context.newPage();
			try {
				await open(page, values.url);
				const variants = await page.evaluate(
					([id, entries]) => window.sonoraShot.load(id, entries),
					[id, entries]
				);
				for (const [stem, title] of variants) {
					const dir = join(id, stem);
					await mkdir(join(values.out, dir), { recursive: true });
					theme.variants.push(
						await variant(page, values.url, [id, entries], title, values.out, dir)
					);
				}
			} catch (error) {
				theme.error = String(error.message ?? error).replace(/^Error: /, '');
				console.error(`${id}: ${theme.error}`);
			} finally {
				await page.close();
			}
		}
	} finally {
		await browser.close();
	}
	await writeFile(join(values.out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}

async function open(page, url) {
	await page.goto(new URL('/themes/shot', url).href);
	await page.waitForSelector('[data-ready]');
	await page.evaluate(() => document.fonts.ready);
}

/** Every screen a variant is shown on: where to go, what to hover or open, what to zoom into. */
const SCENES = [
	{
		name: 'album',
		stop: { screen: 'album', id: 'airs' },
		act: (page) => page.locator('.app .table .row').nth(3).hover(),
		zooms: {
			table: (page) => span(page, '.app .table .head', '.app .table .row >> nth=4', 560),
			hero: (page) => box(page, '.app .hero .text'),
			player: (page) => box(page, '.app .bar', { width: 520 }),
			lyrics: (page) => box(page, '.app .aside', { height: 300 })
		}
	},
	{
		name: 'menu',
		stop: { screen: 'album', id: 'airs' },
		act: async (page) => {
			await page.locator('.app .table .row').nth(4).locator('.title').click({ button: 'right' });
			await page.locator('.app [role=menu] .row').nth(1).hover();
		},
		zooms: { menu: (page) => box(page, '.app [role=menu]') }
	},
	{
		name: 'home',
		stop: { screen: 'home' },
		act: (page) => page.locator('.app .sidebar > .row').nth(1).hover(),
		zooms: { sidebar: (page) => box(page, '.app .sidebar', { height: 470 }) }
	},
	{
		name: 'queue',
		stop: { screen: 'album', id: 'airs' },
		act: (page) => page.locator('.app .bar [aria-label="Queue"]').first().click(),
		zooms: { queue: (page) => box(page, '.app .aside', { height: 420 }) }
	},
	{
		name: 'settings',
		stop: { screen: 'settings', tab: 'Appearance' },
		act: async () => {},
		zooms: { settings: (page) => box(page, '.app .screen', { width: 620, height: 380 }) }
	}
];

/**
 * Shoots one variant on every scene and gathers the text it finds below `LOW`. Each scene opens
 * the page afresh, so the theme files in `theme` are loaded again every time.
 */
async function variant(page, url, theme, title, out, dir) {
	const shots = {};
	const zooms = {};
	const spots = new Map();
	for (const scene of SCENES) {
		await open(page, url);
		await page.evaluate(
			([[id, entries], title, stop]) => {
				window.sonoraShot.load(id, entries);
				window.sonoraShot.use(title);
				window.sonoraShot.go(stop);
			},
			[theme, title, scene.stop]
		);
		await page.waitForTimeout(150);
		await scene.act(page);
		await page.waitForTimeout(250);
		shots[scene.name] = `${dir}/${scene.name}.png`;
		await page.locator('.app').screenshot({ path: join(out, shots[scene.name]) });
		for (const [name, measure] of Object.entries(scene.zooms)) {
			const clip = await measure(page).catch(() => null);
			if (!clip) continue;
			zooms[name] = `${dir}/zoom-${name}.png`;
			await page.screenshot({ path: join(out, zooms[name]), clip });
		}
		for (const spot of await page.evaluate(scan, LOW)) {
			const key = `${spot.text}|${spot.fg}|${spot.bg}`;
			const seen = spots.get(key);
			if (!seen || seen.ratio > spot.ratio) spots.set(key, { ...spot, scene: scene.name });
		}
		const worst = [...spots.values()]
			.filter((spot) => spot.scene === scene.name && !spot.zoom)
			.sort((a, b) => a.ratio - b.ratio)
			.slice(0, WORST_ZOOMS);
		for (const spot of worst) {
			const taken = [...spots.values()].filter((other) => other.zoom).length;
			if (taken >= WORST_ZOOMS) break;
			spot.zoom = `${dir}/zoom-worst-${taken + 1}.png`;
			await page.screenshot({ path: join(out, spot.zoom), clip: around(spot.box) });
		}
	}
	const found = [...spots.values()].sort((a, b) => a.ratio - b.ratio);
	return {
		title,
		dir,
		shots,
		zooms,
		unreadable: found.filter((spot) => spot.ratio < UNREADABLE).length,
		low: found.filter((spot) => spot.ratio >= UNREADABLE).length,
		spots: found
	};
}

/** The page rectangle of `selector`, cut down to `width` and `height` from its top left corner. */
async function box(page, selector, { width = Infinity, height = Infinity } = {}) {
	const rect = await page.locator(selector).first().boundingBox({ timeout: 1000 });
	if (!rect) return null;
	return {
		x: rect.x,
		y: rect.y,
		width: Math.min(rect.width, width),
		height: Math.min(rect.height, height)
	};
}

/** The rectangle from the top of `from` to the bottom of `to`, at most `width` wide. */
async function span(page, from, to, width) {
	const top = await page.locator(from).first().boundingBox({ timeout: 1000 });
	const bottom = await page.locator(to).first().boundingBox({ timeout: 1000 });
	if (!top || !bottom) return null;
	return {
		x: top.x,
		y: top.y,
		width: Math.min(top.width, width),
		height: bottom.y + bottom.height - top.y
	};
}

/** A zoom around a spot of text, padded and kept at a readable minimum size. */
function around(rect) {
	const width = Math.max(rect.width + PAD * 2, 260);
	const height = Math.max(rect.height + PAD * 2, 90);
	return {
		x: Math.max(rect.x + rect.width / 2 - width / 2, 0),
		y: Math.max(rect.y + rect.height / 2 - height / 2, 0),
		width,
		height
	};
}

/**
 * Runs in the page. Finds every visible piece of text in the mock whose colour, over the
 * backgrounds stacked under it, has less contrast than `limit`. Text inside blurred or
 * fully transparent layers is skipped, since nobody is meant to read it, and so is disabled
 * text, which WCAG leaves out.
 */
function scan(limit) {
	const app = document.querySelector('.app');
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = 1;
	const ink = canvas.getContext('2d', { willReadFrequently: true });
	const rgba = (value) => {
		ink.clearRect(0, 0, 1, 1);
		ink.fillStyle = '#000';
		ink.fillStyle = value;
		ink.fillRect(0, 0, 1, 1);
		const [r, g, b, a] = ink.getImageData(0, 0, 1, 1).data;
		return [r, g, b, a / 255];
	};
	const over = (top, under) =>
		[0, 1, 2].map((at) => top[at] * top[3] + under[at] * (1 - top[3])).concat(1);
	const light = ([r, g, b]) => {
		const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
		return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
	};
	const hex = (color) =>
		'#' +
		color
			.slice(0, 3)
			.map((c) => Math.round(c).toString(16).padStart(2, '0'))
			.join('');
	const frame = app.getBoundingClientRect();
	const found = [];
	const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
	const seen = new Set();
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const element = node.parentElement;
		if (!node.textContent.trim() || !element || seen.has(element)) continue;
		seen.add(element);
		if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
		if (element.closest(':disabled, [aria-disabled="true"], .disabled')) continue;
		const range = document.createRange();
		range.selectNodeContents(node);
		const rect = range.getBoundingClientRect();
		if (rect.width < 2 || rect.height < 2) continue;
		if (
			rect.right < frame.left ||
			rect.left > frame.right ||
			rect.bottom < frame.top ||
			rect.top > frame.bottom
		)
			continue;
		const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
		if (!hit || !(element.contains(hit) || hit.contains(element))) continue;
		let alpha = 1;
		let hidden = false;
		const layers = [];
		for (let at = element; at && at !== app.parentElement; at = at.parentElement) {
			const style = getComputedStyle(at);
			alpha *= Number(style.opacity);
			if (style.filter.includes('blur')) hidden = true;
			layers.push(rgba(style.backgroundColor));
		}
		if (hidden || alpha < 0.05) continue;
		let ground = [255, 255, 255, 1];
		for (const layer of layers.reverse()) ground = over(layer, ground);
		const text = rgba(getComputedStyle(element).color);
		text[3] *= alpha;
		const seenText = over(text, ground);
		const [a, b] = [light(seenText), light(ground)].sort((x, y) => y - x);
		const ratio = (a + 0.05) / (b + 0.05);
		if (ratio >= limit) continue;
		found.push({
			text: node.textContent.trim().slice(0, 40),
			ratio: Math.round(ratio * 100) / 100,
			fg: hex(seenText),
			bg: hex(ground),
			box: { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height }
		});
	}
	return found;
}

async function markdown(args) {
	const { values } = parseArgs({
		args,
		options: {
			report: { type: 'string' },
			base: { type: 'string' },
			marker: { type: 'string', default: '' },
			head: { type: 'string', default: '' }
		}
	});
	const report = JSON.parse(await readFile(values.report, 'utf8'));
	const url = (path) => `${values.base.replace(/\/+$/, '')}/${path}`;
	const image = (path, alt, width) =>
		`<img src="${url(path)}" alt="${alt}"${width ? ` width="${width}"` : ''}>`;
	const lines = [values.marker, '## Theme preview', ''];
	lines.push(
		`Screenshots of the theme in the website's replica of Sonora${values.head ? ` at ${values.head}` : ''}. Zooms are at 2×. The replica is close to the app but not identical, so install the theme to be sure.`,
		''
	);
	for (const theme of report.themes) {
		if (theme.error) {
			lines.push(`### \`${theme.id}\``, '', `The theme could not be loaded: ${theme.error}`, '');
			continue;
		}
		for (const variant of theme.variants) {
			const verdict = variant.unreadable
				? `🔴 ${variant.unreadable} unreadable ${variant.unreadable === 1 ? 'spot' : 'spots'} under ${UNREADABLE}:1`
				: variant.low
					? `🟡 ${variant.low} low-contrast ${variant.low === 1 ? 'spot' : 'spots'} under ${LOW}:1`
					: `🟢 all text measured at ${LOW}:1 or better`;
			lines.push(
				`### ${variant.title}`,
				'',
				verdict,
				'',
				image(variant.shots.album, `${variant.title} on an album page`),
				''
			);
			const zooms = [
				...Object.entries(variant.zooms).map(([name, path]) => [LABELS[name] ?? name, path]),
				...variant.spots
					.filter((spot) => spot.zoom)
					.map((spot) => [`"${spot.text}" ${spot.ratio}:1`, spot.zoom])
			];
			lines.push('<table><tr>');
			zooms.forEach(([name, path], at) => {
				if (at && at % 2 === 0) lines.push('</tr><tr>');
				lines.push(
					`<td valign="top"><sub>${escape(name)}</sub><br>${image(path, escape(name))}</td>`
				);
			});
			lines.push('</tr></table>', '');
			if (variant.spots.length) {
				lines.push(
					'<details><summary>Text below 4.5:1</summary>',
					'',
					'| Text | Screen | Contrast | Text colour | Background |',
					'|---|---|---|---|---|'
				);
				for (const spot of variant.spots.slice(0, 25)) {
					lines.push(
						`| ${escape(spot.text)} | ${spot.scene} | ${spot.ratio}:1 | \`${spot.fg}\` | \`${spot.bg}\` |`
					);
				}
				if (variant.spots.length > 25)
					lines.push(`| … ${variant.spots.length - 25} more | | | | |`);
				lines.push('', '</details>', '');
			}
			lines.push('<details><summary>Other screens</summary>', '');
			for (const name of ['menu', 'home', 'queue', 'settings']) {
				if (variant.shots[name])
					lines.push(image(variant.shots[name], `${variant.title}, ${name}`), '');
			}
			lines.push('</details>', '');
		}
	}
	process.stdout.write(lines.join('\n'));
}

function escape(text) {
	return String(text).replace(
		/[|<>&"]/g,
		(char) => ({ '|': '\\|', '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[char]
	);
}

const [command, ...rest] = process.argv.slice(2);
if (command === 'shoot') await shoot(rest);
else if (command === 'markdown') await markdown(rest);
else {
	console.error('usage: theme-shots.mjs shoot|markdown [options]');
	process.exit(2);
}
