const https = require("https");
const fs = require("fs");
var room_id = process.argv[2]
console.log(room_id)

https.get("https://chat.luvul.net/PastLogList?room_id=" + room_id, (response) => {
    let statusCode = response.statusCode; // HTTP ステータスコード
    if (statusCode !== 200) { // ステータスコードが 200 以外の場合はエラーを吐いて終了する
        console.error(`Request failed (status code: ${statusCode})`);
        response.resume();
        return;
    }
    response.setEncoding("utf8");
    let rawData = '';
    response.on('data', (chunk) => { rawData += chunk; }); // 受信中に 'data' イベントが発生する
    response.on('end', () => { // 受信終了
        var title = rawData.match(/<title>「(.+?)」の過去ログ一覧/)[1]
        var m = rawData.match(/<a href=".+?">.+?の過去ログ/gim)
        var stat = fs.statSync(title)
        if (!stat.isDirectory()) {
            fs.mkdirSync(title)
        }
        m.forEach(l => {
            l = l.replace(/&amp;/g, "&")
            var name = title + "/" + l.match(/>(.+)/)[1].replace(/[\/:]/g, "") + ".html"
            var path = l.match(/<a href="(.+?)">/)[1]

            https.get("https://chat.luvul.net" + path, (response) => {
                let statusCode = response.statusCode; // HTTP ステータスコード
                if (statusCode !== 200) { // ステータスコードが 200 以外の場合はエラーを吐いて終了する
                    console.error(`Request failed (status code: ${statusCode})`);
                    response.resume();
                    return;
                }
                response.setEncoding("utf8");
                let rawData = '';
                response.on('data', (chunk) => { rawData += chunk; }); // 受信中に 'data' イベントが発生する
                response.on('end', () => { // 受信終了
                    fs.writeFileSync(name, rawData)
                })
            })
        })
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
