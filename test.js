import { Client } from 'https://static.alca.tv/twitch/u/tmi.js/2.0.0-browsertest-002-c7958ed/tmi.esm-browser.min.mjs';

if(location.href.includes('/fullcpgrid/')) {
	throw new Error('Not rendering on preview');
}

const channelId = '89181064';
const storageKey = 'alca-jOoqgOP';

renderEmotes(loadHistory());

const emotesData = { emotes: new Map(), regex: null };
getEmotes().then(data => {
	emotesData.emotes = data.emotes;
	emotesData.regex = data.regex;
});

const client = new Client({
	initialChannels: [ 'secondubly', 'sirenetie', 'supernamu' ]
});

client.connect();

client.on('message', onEvent);
client.on('resub', onEvent);
client.on('announcement', onEvent);
client.on('viewermilestone', onEvent);

function onEvent({ message }) {
	if(!message.text) {
		return;
	}
	
	debugger;
	const { emotes: twitchEmotes } = message;
	const text = [ ...message.text ];
	const getTextSlice = (start, end) => ({ type: 'text', text: text.slice(start, end).join(''), start, end });
	const parts = [];
	
	const integrateEmotes = emotes => {
		const newParts = [];
		if(emotes.length) {
			if(emotes[0].start > 0) {
				newParts.push(getTextSlice(0, emotes[0].start));
			}
			emotes.forEach((n, i) => {
				newParts.push(n);
				if(i === emotes.length - 1 && n.end < text.length) {
					newParts.push(getTextSlice(n.end, text.length));
				}
				else if(i < emotes.length - 1) {
					newParts.push(getTextSlice(n.end, emotes[i + 1].start));
				}
			});
		}
		return newParts;
	};
	
	// Twitch emotes:
	if(message.emotes.size) {
		const emotes = [ ...message.emotes ].flatMap(([ id, indicies ]) => {
			const emote = { type: 'emote', provider: 'twitch', url: `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/4.0` };
			return indicies.map(n => ({ ...emote, start: n[0], end: n[1] }));
		})
		.sort((a, b) => a.start - b.start);
		parts.push(...integrateEmotes(emotes));
	}
	else {
		parts.push(getTextSlice(0, text.length));
	}
	
	// Third party emotes:
	if(emotesData.regex) {
		for(let i = parts.length - 1; i >= 0; i--) {
			const t = parts[i];
			if(t.type !== 'text') {
				continue;
			}
			const text = [ ...t.text ];
			const emotes = [ ...t.text.matchAll(emotesData.regex) ].map(n => {
				const { '0': code, index } = n;
				const { provider, url } = emotesData.emotes.get(code);
				const start = index + t.start;
				const end = start + code.length;
				return { type: 'emote', provider, url, start, end };
			});
			parts.splice(i, 1, ...integrateEmotes(emotes));
		}
	}
	
	const emoteList = parts.filter(n => n.type === 'emote');
	renderEmotes(emoteList);
	addToHistory(emoteList);
}

function renderEmotes(list) {
	chat.append(...list.map(n => {
		const ele = document.createElement('div');
		// ele.classList.add('msg-part', `msg-part-${n.type}`);
		ele.classList.add('msg-part', 'msg-part-emote');
		ele.style.backgroundImage = `url(${n.url})`;
		return ele;
	}));
	for(const ele of [ ...chat.children ]) {
		if(ele.getBoundingClientRect().top < -112) {
			ele.remove();
		}
		else {
			break;
		}
	}
}

function loadHistory() {
	try {
		return JSON.parse(localStorage.getItem(storageKey) ?? '[]');
	} catch(err) {}
	return [];
}

function addToHistory(list) {
	const existingHistory = loadHistory();
	const now = Date.now();
	const newList = existingHistory.slice(-400).filter(n => n.created + 1000 * 60 * 60 > now)
		.concat(list.map(n => ({ url: n.url, created: now })));
	localStorage.setItem(storageKey, JSON.stringify(newList));
}

async function getEmotes() {
	const convert = (provider, code, url) => ({ provider, code, url });
	const bttv = {
		baseUrl: 'https://api.betterttv.net/3/cached',
		convert: emote => convert('bttv', emote.code, `https://cdn.betterttv.net/emote/${emote.id}/4x`),
		fetch: endpoint => getJson(`${bttv.baseUrl}/${endpoint}`),
		global: () => bttv.fetch('emotes/global').then(data => data.map(n => bttv.convert(n))),
		channel: (id = channelId) => bttv.fetch(`users/twitch/${id}`).then(data => [ ...data.channelEmotes, ...data.sharedEmotes ].map(bttv.convert))
	};
	const ffz = {
		baseUrl: 'https://api.frankerfacez.com/v1',
		convert: emote => convert('ffz', emote.name, emote.urls['2']),
		fetch: endpoint => getJson(`${ffz.baseUrl}/${endpoint}`),
		global: () => ffz.fetch('set/global').then(data => data.default_sets.flatMap(setId => data.sets[setId].emoticons.map(n => ffz.convert(n)))),
		channel: (id = channelId) => ffz.fetch(`room/id/${id}`).then(data => data.sets[data.room.set].emoticons.map(ffz.convert))
	};
	const sevenTV = {
		baseUrl: 'https://7tv.io/v3',
		convert: emote => convert('7tv', emote.name, `https://cdn.7tv.app/emote/${emote.id}/4x.webp`),
		fetch: endpoint => getJson(`${sevenTV.baseUrl}/${endpoint}`),
		global: () => sevenTV.fetch('emote-sets/global').then(data => data.emotes.map(n => sevenTV.convert(n))),
		channel: (id = channelId) => sevenTV.fetch(`users/twitch/${id}`).then(data => data.emote_set.emotes.map(sevenTV.convert))
	};

	const emotes = (await Promise.all([
		bttv.global(), bttv.channel(), ffz.global(), ffz.channel(), sevenTV.global(), sevenTV.channel()
	].map((n, i) => n.catch(err => {
		console.error([ 'bttv', 'ffz', '7TV' ][i / 2 | 0], i, err);
		return [];
	}))))
	.reduce((p, n) => (n.forEach(emote => p.set(emote.code, emote)), p), new Map());
    console.log(emotes)
	const regex = new RegExp(`(?:\\b|^)(?:${[ ...emotes.values() ].map(e => escapeForRegex(e.code)).join('|')})(?:\\b|$)`, 'gu');
	return { emotes, regex };
}

function escapeForRegex(input) {
	return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getJson(url) {
	const res = await fetch(url);
	return res.json();
}