const { Client, GatewayIntentBits, Interaction, MessageActionRow, MessageButton } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } = require('@discordjs/voice');
const { createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const fetch = require('isomorphic-fetch');
const fs = require('fs/promises'); // Import the fs module for file operations
const os = require('os');
const packageJson = require('./package.json');

const client = new Client({
  intents: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const streamUrl = 'http://replaceme/listen/STATION_NAME/*.mp3';
const apiUrl = 'http://replaceme/api/nowplaying/STATION_NAME';
const statusTexts = [
  { name: 'title', duration: 2000 },
  { name: 'artist', duration: 2000 },
  { name: 'RADIO_NAME', duration: 2000 },
];

let currentStatusIndex = 0;

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.application.commands.set([
    {
      name: 'playnow',
      description: 'Plays the RADIO_NAME radio stream.',
    },
    {
      name: 'nowplaying',
      description: 'Shows the currently playing song on RADIO_NAME.',
    },
    {
      name: 'status',
      description: 'Displays bot status information.',
    },
  ]);

  updateStatus();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'playnow') {
    await interaction.deferReply();

    const connection = joinVoiceChannel({
      channelId: interaction.member.voice.channelId,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });

    const stream = createAudioResource(streamUrl);
    const player = createAudioPlayer();
    player.play(stream);
    connection.subscribe(player);

    await interaction.editReply('Started streaming in voice channel.');

    setTimeout(() => {
      if (player.state.status !== 'playing') {
        console.log('Stream killed? Restarting...');
        player.stop();
        player.play(stream);
      }
    }, 5000);
  } else if (commandName === 'nowplaying') {
    await interaction.deferReply();

    try {
      const response = await fetch(apiUrl);
      const rawData = await response.text();
      console.log('Raw API response:', rawData);

      const data = JSON.parse(rawData);
      const title = data.now_playing.song.title;
      const artist = data.now_playing.song.artist;

      const adFilePath = 'ad.txt';
      const dynamicAd = await fetchDynamicAd(adFilePath);

      await interaction.editReply(`Currently playing on STATION_NAME: ${title} by ${artist} | ${dynamicAd}`);
    } catch (error) {
      console.error('Error fetching current song:', error);
      await interaction.editReply('Failed to fetch the currently playing song.');
    }
  } else if (commandName === 'status') {
    await interaction.deferReply();

    const serverCount = client.guilds.cache.size;
    const userCount = client.users.cache.size;
    const uptime = getUptime();
    const memoryUsage = getMemoryUsage();

    const statusMessage = `
      **Server Count**: ${serverCount}
      **User Count**: ${userCount}
      **Node Uptime**: ${uptime}
      **Memory Usage**: ${memoryUsage}
      **Packages Used**: ${JSON.stringify(packageJson.dependencies)}
    `;

    await interaction.editReply(`Bot Status:\n${statusMessage}`);
  }
});

client.on('messageCreate', async (message) => {
  if (message.content === '!playnow') {
    const row = new MessageActionRow().addComponents(
      new MessageButton().setCustomId('playnow').setLabel('Play Now').setStyle('PRIMARY')
    );

    await message.reply({
      content: 'Click the button below to play now!',
      components: [row],
    });
  }
});

async function updateStatus() {
  try {
    const response = await fetch(apiUrl);
    const rawData = await response.text();
    console.log('Raw API response:', rawData);

    const data = JSON.parse(rawData);
    const title = data.now_playing.song.title;
    const artist = data.now_playing.song.artist;
    const statusText = getStatusText(currentStatusIndex, title, artist);

    updatePresence(statusText);

    console.log('Current status:', statusText);

    currentStatusIndex = (currentStatusIndex + 1) % statusTexts.length;

    setTimeout(updateStatus, statusTexts[currentStatusIndex].duration);
  } catch (error) {
    console.error('Error fetching current song:', error);
    setTimeout(updateStatus, 5000);
  }
}

function getStatusText(index, title, artist) {
  if (statusTexts[index].name === 'title') {
    return title;
  } else if (statusTexts[index].name === 'artist') {
    return artist;
  } else {
    return statusTexts[index].name;
  }
}

function updatePresence(text) {
  if (client.user) {
    client.user.setPresence({
      activities: [{ name: text }],
      status: 'online',
    });

    console.log('Current status:', text);
  }
}

function getUptime() {
  const uptimeSeconds = process.uptime();
  const seconds = Math.floor(uptimeSeconds % 60);
  const minutes = Math.floor((uptimeSeconds / 60) % 60);
  const hours = Math.floor((uptimeSeconds / (60 * 60)) % 24);
  const days = Math.floor(uptimeSeconds / (60 * 60 * 24));

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function getMemoryUsage() {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  const total = process.memoryUsage().heapTotal / 1024 / 1024;

  return `${used.toFixed(2)} MB (${total.toFixed(2)} MB)`;
}

async function fetchDynamicAd(filePath) {
  try {
    const adText = await fs.readFile(filePath, 'utf-8');
    return adText.trim();
  } catch (error) {
    console.error('Error reading dynamic ad file:', error);
    return 'Error fetching dynamic ad';
  }
}

client.login('replaceme');
