const client = new tmi.Client({
	channels: [ 'secondubly' ]
});

const chat = document.querySelector("#chat")

client.on('message', (channel, tags, message, _) => {
    const newMessage = document.createElement("li")
    const author = document.createElement("strong");
    newMessage.classList.add("message");
    const text = document.createElement("p")
    
    author.innerText = tags["display-name"]
    text.innerText = message

    newMessage.append(author)
    newMessage.append(text)
    console.debug(tags)


    if (badges !== null) {
        if (badges.broadcaster) {
            newMessage.classList.add("broadcaster")
        } else if (badges.vip) {
            newMessage.classList.add("vip")
        }
    }

    chat.append(newMessage)
});

client.on('join', (channel, username, self) => {
    console.info(`successfully joined ${channel}`)
})

const loadEmotes = () => {
    // load global twitch emotes
    fetch('')
}

const parseAuthorType = (tags, message) => {
    const badges = tags.badges
    if (!badges) {
        return null
    }

    if (badges.broadcaster) {
        message.classList.add('broadcaster')
    } else if (tags.moderator) {
        return message.classList.add('moderator')
    } else if (tags.subscriber) {
        return subscriber
    } else if (badges.vip) {
        return "vip"
    }

    return
}

client.connect()