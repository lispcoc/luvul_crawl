const puppeteer = require('puppeteer');

// PushbulletのAPIキー
const ACCESS_TOKEN = 'o.bL0CQvqzny5A9AAUSsrZeFrBwJIroRA5'; // ここにPushbulletのAPIキーを入力

const WEBHOOK = "https://discord.com/api/webhooks/1428388773829283901/cv6YJP6ZJHMv1X9AM_5fasrYlkAi0BrGdu1DzBDANBt1TBcvkP8K2ZGPJcbYmKh0OcfR"

// 通知を送信する関数
async function sendPushbulletNotification(title, message) {
  const url = WEBHOOK

  const payload = {
    content: "<@463235624619737090> " + message, // 通知の本文
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTPエラー: ${response.status}`);
    }

    console.log('通知が送信されました:', message);
  } catch (error) {
    console.error('通知の送信中にエラーが発生しました:', error.message);
  }
}

(async () => {
  // ブラウザを起動
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser'
  });
  const urls = [
    'https://chat.luvul.net/ChatRoom?room_id=401056',
    'https://chat.luvul.net/ChatRoom?room_id=420005',
    'https://chat.luvul.net/ChatRoom?room_id=412404',
  ];

  for (const url of urls) {
    const page = await browser.newPage();

    // チャットサイトにアクセス
    await page.goto(url);

    // チャットコンテナのセレクタ
    const chatContainerSelector = '#chatlogarea'; // 適切なセレクタに置き換え

    // チャットコンテナがロードされるまで待機
    await page.waitForSelector(chatContainerSelector);

    console.log('チャットの監視を開始します');

    // 以前のメッセージを追跡するためのセット
    const previousMessages = new Set();

    // チャットの監視
    await page.exposeFunction('onNewMessage', (message) => {
      if (message.search(/入室しました/) !== -1 || message.search(/退室しました/) !== -1) {
          // 通知を送信
          sendPushbulletNotification('通知タイトル', message);
      }
      console.log('新しいメッセージ:', message);
    });

    await page.evaluate((chatContainerSelector) => {
      const chatContainer = document.querySelector(chatContainerSelector);

      if (chatContainer) {
        const previousMessages = new Set();

        // MutationObserverを設定
        const observer = new MutationObserver((mutationsList) => {
          for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const messageText = node.textContent.trim();
                  if (!previousMessages.has(messageText)) {
                    previousMessages.add(messageText);
                    window.onNewMessage(messageText); // 新しいメッセージを通知
                  }
                }
              });
            }
          }
        });

        // 監視を開始
        observer.observe(chatContainer, { childList: true, subtree: true });
      }
    }, chatContainerSelector);
  }

  // スクリプトを終了しないように待機
  await new Promise(() => {});
})();
