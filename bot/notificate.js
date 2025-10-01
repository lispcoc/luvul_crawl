// PushbulletのAPIキー
const ACCESS_TOKEN = 'o.3XaeWgYySjWXiDT5kRrKT6VOJ1nELHns'; // ここにPushbulletのAPIキーを入力

// 通知を送信する関数
async function sendPushbulletNotification(title, message) {
  const url = 'https://api.pushbullet.com/v2/pushes';

  const payload = {
    type: 'note', // 通知のタイプ（note: 通常の通知）
    title: title, // 通知のタイトル
    body: message, // 通知の本文
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTPエラー: ${response.status}`);
    }

    const data = await response.json();
    console.log('通知が送信されました:', data);
  } catch (error) {
    console.error('通知の送信中にエラーが発生しました:', error.message);
  }
}

// 通知を送信
sendPushbulletNotification('通知タイトル', 'これはNode.jsから送信されたPushbullet通知です');

