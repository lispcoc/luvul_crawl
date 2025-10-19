const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

function getDqateString() {
    var date = new Date();
    return date.getFullYear() + '_' + ('0' + (date.getMonth() + 1)).slice(-2) + '_' + ('0' + date.getDate()).slice(-2);
}

var dateString = {};
var fh = {};

(async () => {
  // ブラウザを起動
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/chromium-browser'
  });
  const rids = [
    '360109',
  ];

  for (const rid of rids) {
    const url = 'https://chat.luvul.net/ChatRoom?room_id=' + rid;
    const page = await browser.newPage();

    dateString[rid] = getDqateString();
    fs.existsSync('logs') || fs.mkdirSync('logs');
    fh[rid] = fs.openSync(path.join(__dirname, 'logs', `log_${rid}_${dateString[rid]}.txt`), 'a');

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
        if (dateString[rid] != getDqateString()) {
            dateString[rid] = getDqateString();
            fs.closeSync(fh[rid]);
            fh[rid] = fs.openSync(path.join(__dirname, 'logs', `log_${rid}_${dateString[rid]}.txt`), 'a');
        }
        console.log(message);
        fs.writeSync(fh[rid], message + '\n');
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

        // 既存のメッセージも処理
        var messages = [];
        chatContainer.childNodes.forEach((node) => {
            messages.unshift(node.textContent.trim());
        })
        for (message of messages) {
            if (message.search(/\(\d+\/\d+ \d+:\d+:\d+\)/) !== -1) {
                window.onNewMessage(message)
            }
        }

        // 監視を開始
        observer.observe(chatContainer, { childList: true, subtree: true });
      }
    }, chatContainerSelector);
  }

  // スクリプトを終了しないように待機
  await new Promise(() => {});
})();
