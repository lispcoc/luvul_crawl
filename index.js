const https = require("https");
const fs = require("fs");
const parser =  require('node-html-parser');
const { convert } = require('html-to-text');
const options = {
    wordwrap: 130,
    blockTextElements: {
        script: false
    },
    selectors: [
        {
            selector: 'hr',
            format: 'block'
        },
    ]
};
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
        var title = "[" + room_id + "]" + rawData.match(/<title>「(.+?)」の過去ログ一覧/)[1]
        var m = rawData.match(/<a href=".+?">.+?の過去ログ/gim)
        if (!fs.existsSync(title) || !fs.statSync(title).isDirectory()) {
            fs.mkdirSync(title)
        }
        m.forEach(l => {
            l = l.replace(/&amp;/g, "&")
            var name = title + "/" + l.match(/>(.+)/)[1].replace(/[\/:]/g, "")
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
                    fs.writeFileSync(name + ".html", rawData)
                    let dom = parser.parse(rawData);
                    dom.querySelectorAll('hr').forEach(x=> x.remove());
                    fs.writeFileSync(name + ".txt", convert(dom.toString(), options))
                })
            })
        })
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
