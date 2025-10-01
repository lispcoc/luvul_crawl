const puppeteer = require('puppeteer');

(async () => {
  // ブラウザを起動
  const browser = await puppeteer.launch({ headless: true }); // headless: true にすると非表示で動作
  const page = await browser.newPage();

  // チャットサイトにアクセス
  //await page.goto('https://chat.luvul.net/ChatRoom?room_id=420005');
  await page.goto('https://chat.luvul.net/ChatRoom?room_id=131694');

  // チャットコンテナのセレクタ
  const chatContainerSelector = '#chatlogarea'; // 適切なセレクタに置き換え

  // チャットコンテナがロードされるまで待機
  await page.waitForSelector(chatContainerSelector);

  console.log('チャットの監視を開始します');

  // 以前のメッセージを追跡するためのセット
  const previousMessages = new Set();

  // チャットの監視
  await page.exposeFunction('onNewMessage', (message) => {
    let r = message.search(/しました/);
    console.log(r);
    if (message.search(/しました/) !== -1) {
        console.log('新しいメッセージ:', message);
    }
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

  // スクリプトを終了しないように待機
  await new Promise(() => {});
})();
