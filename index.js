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
const url = (rid, page) => "https://chat.luvul.net/?action=PastLogList&pageFrom=" + page + "&room_id=" + rid
const errot_callback = (e) => {
    console.error(`Got error: ${e.message}`);
}

function processRoom(room_id, doneCallback) {
    let page = 0
    const callback = (response) => {
        let statusCode = response.statusCode;
        if (statusCode !== 200) {
            console.error(`Request failed (status code: ${statusCode})`);
            response.resume();
            if (doneCallback) doneCallback();
            return;
        }
        response.setEncoding("utf8");
        let rawData = '';
        response.on('data', (chunk) => { rawData += chunk; });
        response.on('end', () => {
            var title = "[" + room_id + "]" + rawData.match(/<title>「(.+?)」の過去ログ一覧/)[1]
            var m = rawData.match(/<a href=".+?">.+?の過去ログ/gim)
            if (!m) m = []
            if (!fs.existsSync(title) || !fs.statSync(title).isDirectory()) {
                fs.mkdirSync(title)
            }
            m.forEach(l => {
                l = l.replace(/&amp;/g, "&")
                var name = title + "/" + l.match(/>(.+)/)[1].replace(/[\/:]/g, "")
                var path = l.match(/<a href="(.+?)">/)[1]

                https.get("https://chat.luvul.net" + path, (response) => {
                    let statusCode = response.statusCode;
                    if (statusCode !== 200) {
                        console.error(`Request failed (status code: ${statusCode})`);
                        response.resume();
                        return;
                    }
                    response.setEncoding("utf8");
                    let rawData = '';
                    response.on('data', (chunk) => { rawData += chunk; });
                    response.on('end', () => {
                        rawData = rawData.replaceAll('href="/style/', 'href="../style/')
                        let dom = parser.parse(rawData);
                        dom.querySelectorAll('iframe').forEach(x=> x.remove());
                        dom.querySelectorAll('img').forEach(x=> x.remove());
                        dom.querySelectorAll('script').forEach(x=> x.remove());
                        // バージョンクエリ文字列を除去して不要な差分を防ぐ
                        dom.querySelectorAll('link[href]').forEach(el => {
                            const href = el.getAttribute('href');
                            if (href) el.setAttribute('href', href.replace(/\?.*$/, ''));
                        });
                        fs.writeFileSync(name + ".html", dom.toString())
                        dom.querySelectorAll('hr').forEach(x=> x.remove());
                        fs.writeFileSync(name + ".txt", convert(dom.toString(), options))
                        console.log(name)
                    })
                })
            })
            console.log("room " + room_id + " page " + page + " done")
            page += 100
            if (m.length >= 100) {
                setTimeout(() => {
                    https.get(url(room_id, page), callback).on('error', errot_callback)
                }, 60 * 1000)
            } else {
                if (doneCallback) doneCallback();
            }
        });
    }
    https.get(url(room_id, page), callback).on('error', errot_callback);
}

const room_id = process.argv[2]

if (room_id) {
    console.log(room_id)
    processRoom(room_id)
} else {
    // 既存のディレクトリからルームIDを収集して順番に処理する
    const dirs = fs.readdirSync('.').filter(f => {
        try { return fs.statSync(f).isDirectory() && /^\[\d+\]/.test(f); }
        catch (e) { return false; }
    });
    const roomIds = [...new Set(dirs.map(d => d.match(/^\[(\d+)\]/)[1]))];
    console.log('Found rooms: ' + roomIds.join(', '));

    let i = 0;
    function next() {
        if (i >= roomIds.length) {
            console.log('All rooms processed');
            return;
        }
        const rid = roomIds[i++];
        console.log(`Processing room ${rid} (${i}/${roomIds.length})`);
        processRoom(rid, () => setTimeout(next, 5000));
    }
    next();
}
