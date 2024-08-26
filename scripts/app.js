const client = new tmi.Client({
	channels: [ 'secondubly' ]
});


// TODO: get this from API call
const channelId = "89181064"

const emoteData = { emotes: new Map(), regex: null }
const chat = document.querySelector("#chat")

client.on('message', (_channel, tags, message, _) => {
    if (!message) {
        return
    }

    const newMessage = document.createElement("li")
    const author = document.createElement("strong")
    newMessage.classList.add("message");
    const text = document.createElement("p")
    
    author.innerText = tags["display-name"]
    text.innerHTML = tags.emotes !== null ? parseEmotes(tags, message) : message

    newMessage.append(author)
    newMessage.append(text)
    console.debug(tags)

    parseAuthorType(tags, newMessage)

    chat.append(newMessage)
});

client.on('join', (channel, _username, _self) => {
    console.info(`successfully joined ${channel}`)
})


const parseAuthorType = (tags, message) => {
    const badges = tags.badges
    if (badges == null) {
        return null
    }

    if (badges.broadcaster) {
        message.classList.add('broadcaster')
    } else if (tags.moderator) {
        return message.classList.add('moderator')
    } else if (tags.subscriber) {
        return message.classList.add('subscriber')
    } else if (badges.vip) {
        return message.classList.add('vip')
    }

    return
}
const parseEmotes = (tags, text) => {
    const twitchEmoteUrl = "https://static-cdn.jtvnw.net/emoticons/v2/{{id}}/default/dark/3.0"
    const emotes = Object.keys(tags.emotes).reduce((arrStart, id) => {
        return arrStart.concat({
            id,
            url: twitchEmoteUrl.replace('{{id}}', id),
            start: Number(tags.emotes[id][0].split("-")[0]),
            end: Number(tags.emotes[id][0].split("-")[1])
        })
    }, [])

    emotes.sort(descendingSort)

    for (const emote of emotes) {
        text = replaceEmotes(text, emote["start"], emote["end"], emote['url'])
    }

    return text
}

async function getEmotes() {
    const convert = (provider, code, url) => ({ provider, code, url });

    const twitch = {
        baseUrl: null,
        convert: emote => convert('twitch', emote.id, `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/4.0`)

    }
    const bttv = {
        baseUrl: 'https://api.betterttv.net/3/cached',
        convert: emote => convert('bttv', emote.code, `https://cdn.betterttv.net/emote/${emote.id}/2x`),
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
        convert: emote => convert('7tv', emote.name, `https://cdn.7tv.app/emote/${emote.id}/2x.webp`),
        fetch: endpoint => getJson(`${sevenTV.baseUrl}/${endpoint}`),
        global: () => sevenTV.fetch('emote-sets/global').then(data => data.emotes.map(n => sevenTV.convert(n))),
        channel: (id = channelId) => sevenTV.fetch(`users/twitch/${id}`).then(data => data.emote_set.emotes.map(sevenTV.convert))
    };
    const emotes = (await Promise.all([
        bttv.global(), bttv.channel(),
        ffz.global(), ffz.channel(),
        sevenTV.global(), sevenTV.channel(),
    ].map((n, i) => n.catch(err => {
        console.error([ 'bttv', 'ffz', '7TV' ][i / 2 | 0], i, err);
        return [];
    })))) // get bttv, ffz, and 7tv emotes and store in array in the format from the convert function ({ provider, code, url })
    .reduce((p, n) => (n.forEach(emote => p.set(emote.code, emote)), p), new Map()); // create a Map of all external emotes where the id (or emote name) is the key, and the value is the convert emote object ({ provider, code, url })

    const regex = new RegExp(`(?:\\b|^)(?:${[ ...emotes.values() ].map(e => escapeForRegex(e.code)).join('|')})(?:\\b|$)`, 'gu');
    return { emotes, regex };
}

function descendingSort(e1, e2) {
    if (e1.end > e2.end) {
        return -1 // e2 goes before e1
    } else if (e1.end < e2.end) {
        return 1 // e1 goes before e2
    }
    return 0 // keep orignal order
}

function escapeForRegex(input) {
	return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getJson(url) {
	const res = await fetch(url);
	return res.json();
}

function replaceEmotes(message, start, end, url) {
    const imgUrl = `<img class="emote" src="${url}" />`
    return message.substring(0, start) + imgUrl + message.substring(end+1)
}

console.info('Loading emote data...')
getEmotes().then(data => {
    emoteData.emotes = data.emotes;
    emoteData.regex = data.regex;
    console.info("Loaded emote data!")
}).catch((e) => {
    console.error('something went wrong', e)
})

console.info("connecting client to chat...")
client.connect()