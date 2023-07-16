const { Client, GatewayIntentBits } = require("discord.js");
const dotenv = require("dotenv");
const speech = require("@google-cloud/speech");
const { Configuration, OpenAIApi } = require("openai");
const axios = require("axios");
const FormData = require("form-data");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const { VoiceConnectionStatus, entersState } = require("@discordjs/voice");
const { createWriteStream, pipeline } = require("stream");

// Load environment variables
dotenv.config();

// Coach artie elevenlabs voice ID
const VOICE_ID = process.env.ELEVEN_LABS_VOICE_ID;

// Create a SpeechClient
const speechClient = new speech.SpeechClient();

// Create a Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_API_ORGANIZATION,
});
const openai = new OpenAIApi(configuration);

// Authenticate with Google Cloud using service account credentials
const googleCredentials = require("./coach-artie-3e4ebe0a5be4.json");
speechClient.auth.fromJSON(googleCredentials);

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const voiceChannel = await client.channels.fetch(
    process.env.DISCORD_VOICE_CHANNEL_ID
  );
  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  connection.on(VoiceConnectionStatus.Ready, () => {
    console.log(
      "The connection has entered the Ready state - ready to play audio!"
    );
  });

  connection.on(
    VoiceConnectionStatus.Disconnected,
    async (oldState, newState) => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        // Seems to be reconnecting to a new channel - ignore disconnect
      } catch (error) {
        // Seems to be a real disconnect which SHOULDN'T be recovered from
        connection.destroy();
      }
    }
  );

  const player = createAudioPlayer();
  connection.subscribe(player);

  player.on(AudioPlayerStatus.Idle, () => {
    connection.destroy();
  });

  const receiver = connection.receiver;
  connection.on("stateChange", (oldState, newState) => {
    if (newState.status === VoiceConnectionStatus.Ready) {
      console.log(
        "The connection has entered the Ready state - ready to play audio!"
      );
    } else if (newState.status === VoiceConnectionStatus.Disconnected) {
      connection.destroy();
    }
  });

  connection.on("speaking", async (user, speaking) => {
    if (speaking) {
      console.log(`${user.username} started speaking`);

      const audioStream = receiver.subscribe(user.id);
      const filename = `./recordings/${Date.now()}-${user.username}.pcm`;
      const fileStream = createWriteStream(filename);

      pipeline(audioStream, fileStream, async (error) => {
        if (error) {
          console.error("Error saving audio to file: ", error);
          return;
        }

        console.log(`Recorded audio saved to file: ${filename}`);

        // Transcribe speech using Google Cloud Speech-to-Text API
        const transcription = await transcribeSpeech(filename);

        // Process the transcription with GPT-4 and play audio response
        await processGpt4Response(transcription, connection);
      });
    }
  });
});

client.login(process.env.DISCORD_BOT_TOKEN);

async function processGpt4Response(text, connection) {
  // Pass the transcription to GPT-4
  const gptResponse = await openai.complete({
    model: "gpt-4.0-turbo",
    prompt: text,
    maxTokens: 100,
  });

  const gptResponseText = gptResponse.data.choices[0].text;

  // Send GPT-4 response text to Eleven Labs API for audio playback
  const audioResponse = await sendTextToElevenLabsAPI(
    gptResponseText,
    VOICE_ID
  );

  // Create audio resource and play the response
  const resource = createAudioResource(audioResponse);
  connection.play(resource);
}

async function sendTextToElevenLabsAPI(text, voiceId) {
  const formData = new FormData();
  formData.append("text", text);
  formData.append("model_id", voiceId);

  // Add voice_settings to the FormData
  formData.append(
    "voice_settings",
    JSON.stringify({
      stability: 0.58,
      similarity_boost: 0.185,
    })
  );

  // Prepare the config object with headers
  const config = {
    headers: {
      ...formData.getHeaders(),
      "xi-api-key": process.env.ELEVEN_LABS_API_KEY,
    },
  };

  // Send a POST request to the Eleven Labs API
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const response = await axios.post(url, formData, config);

  return response.data;
}

async function transcribeSpeech(audioFilename) {
  const request = {
    config: {
      encoding: "LINEAR16",
      sampleRateHertz: 48000,
      languageCode: "en-US",
    },
    interimResults: true,
    audio: {
      content: audioFilename,
    },
  };

  const [response] = await speechClient.recognize(request);

  let transcription = "";

  for (const result of response.results) {
    transcription += result.alternatives[0].transcript;
  }

  return transcription;
}
