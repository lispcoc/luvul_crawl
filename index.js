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
let page = 0
const url = (rid, page) => "https://chat.luvul.net/?action=PastLogList&pageFrom=" + page + "&room_id=" + rid
const errot_callback = (e) => {
    console.error(`Got error: ${e.message}`);
}
let callback = (response) =>  {
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
                    rawData = rawData.replaceAll('href="/style/', 'href="../style/')
                    let dom = parser.parse(rawData);
                    dom.querySelectorAll('iframe').forEach(x=> x.remove());
                    dom.querySelectorAll('img').forEach(x=> x.remove());
                    dom.querySelectorAll('script').forEach(x=> x.remove());
                    fs.writeFileSync(name + ".html", dom.toString())
                    dom.querySelectorAll('hr').forEach(x=> x.remove());
                    fs.writeFileSync(name + ".txt", convert(dom.toString(), options))
                    console.log(name)
                })
            })
        })
        console.log("page " + page + " done")
        if (m.length > 0) {
            setTimeout(() => {
                https.get(
                    url( room_id, page ),
                    callback
                ).on('error', errot_callback)
            }, 60 * 1000)
            page += 100
        }
    });
}

https.get(
    url( room_id, page ),
    callback
).on('error', errot_callback);
