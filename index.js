require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const bot = new TelegramBot(process.env.TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const userName = msg.from.first_name;
  const chatId = msg.chat.id;
  const welcomeMsg = `Привет, ${userName}! Отправь мне текст или используй /search <запрос>, и я найду для тебя видео на YouTube.`;
  bot.sendMessage(chatId, welcomeMsg);
});

bot.onText(/\/search (.+)/, async (msg, match) => {
  const query = match[1].trim();
  await searchAndSendVideos(msg.chat.id, query);
});

bot.on("message", async (msg) => {
  if (!msg.text.startsWith("/")) {
    await searchAndSendVideos(msg.chat.id, msg.text.trim());
  }
});

bot.on("inline_query", async (inlineQuery) => {
  const q = inlineQuery.query.trim();
  if (!q) return;

  try {
    const videos = await searchYoutubeVideos(q, 5);
    const results = videos.map((video, index) => {
      const title = video.title;
      const description = video.description
        ? `\n${video.description.substring(0, 500)}`
        : "";
      const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

      return {
        type: "article",
        id: String(index),
        title,
        description,
        thumb_url: video.thumbnail,
        input_message_content: {
          message_text: `<b>${title}</b>${description}\n<a href="${videoUrl}">${videoUrl}</a>`,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        },
        reply_markup: {
          inline_keyboard: [[{ text: "Открыть", url: videoUrl }]],
        },
      };
    });

    await bot.answerInlineQuery(inlineQuery.id, results);
  } catch (error) {
    console.error("Ошибка в inline-режиме:", error.message);
  }
});

async function searchAndSendVideos(chatId, query) {
  try {
    const videos = await searchYoutubeVideos(query);
    if (videos.length === 0) {
      await bot.sendMessage(chatId, "Ничего не найдено.");
      return;
    }

    for (const video of videos) {
      const title = video.title;
      const desc = video.description
        ? `\n${video.description.substring(0, 300)}`
        : "";
      const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
      const message = `<b>${title}</b>${desc}\n<a href="${videoUrl}">${videoUrl}</a>`;

      await bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [[{ text: "Открыть", url: videoUrl }]],
        },
      });
    }
  } catch (error) {
    console.error("Ошибка при поиске:", error.message);
    await bot.sendMessage(chatId, "Ошибка при выполнении запроса к YouTube.");
  }
}

async function searchYoutubeVideos(query, maxResults = 5) {
  const url = "https://www.googleapis.com/youtube/v3/search";
  const { data } = await axios.get(url, {
    params: {
      part: "snippet",
      q: query,
      type: "video",
      maxResults,
      key: process.env.YOUTUBE_KEY_API,
    },
  });

  return data.items.map((item) => ({
    title: item.snippet.title,
    description: item.snippet.description,
    videoId: item.id.videoId,
    thumbnail: item.snippet.thumbnails?.default?.url,
  }));
}
