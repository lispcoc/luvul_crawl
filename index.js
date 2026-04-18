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

const RATE_LIMIT_COUNT = 10;    // 何件ごとに待機するか
const RATE_LIMIT_DELAY = 30000; // 待機時間(ms)

// グローバル取得カウンター（全部屋共通）
let globalFetchCount = 0;

function fetchLogFile(path, name, onDone) {
    https.get("https://chat.luvul.net" + path, (response) => {
        if (response.statusCode !== 200) {
            console.error(`Request failed (status code: ${response.statusCode})`);
            response.resume();
            onDone();
            return;
        }
        response.setEncoding("utf8");
        let rawData = '';
        response.on('data', (chunk) => { rawData += chunk; });
        response.on('end', () => {
            rawData = rawData.replaceAll('href="/style/', 'href="../style/')
            let dom = parser.parse(rawData);
            dom.querySelectorAll('iframe').forEach(x => x.remove());
            dom.querySelectorAll('img').forEach(x => x.remove());
            dom.querySelectorAll('script').forEach(x => x.remove());
            dom.querySelectorAll('link[href]').forEach(el => {
                const href = el.getAttribute('href');
                if (href) el.setAttribute('href', href.replace(/\?.*$/, ''));
            });
            fs.writeFileSync(name + ".html", dom.toString())
            dom.querySelectorAll('hr').forEach(x => x.remove());
            fs.writeFileSync(name + ".txt", convert(dom.toString(), options))
            globalFetchCount++;
            console.log(`[${globalFetchCount}] ${name}`)
            onDone();
        })
    }).on('error', errot_callback);
}

function processQueue(queue, onAllDone) {
    if (queue.length === 0) { onAllDone(); return; }
    const { path, name } = queue.shift();
    fetchLogFile(path, name, () => {
        if (globalFetchCount % RATE_LIMIT_COUNT === 0) {
            console.log(`${globalFetchCount}件取得済み、${RATE_LIMIT_DELAY / 1000}秒待機...`)
            setTimeout(() => processQueue(queue, onAllDone), RATE_LIMIT_DELAY)
        } else {
            processQueue(queue, onAllDone)
        }
    })
}

function processRoom(room_id, doneCallback, fullMode) {
    let page = 0
    let newestExisting = null // 部屋ディレクトリ内の最新既存ファイル名(拡張子なし)、初回ページで確定
    const callback = (response) => {
        if (response.statusCode !== 200) {
            console.error(`Request failed (status code: ${response.statusCode})`);
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
            // 初回ページのみ: ディレクトリ内の既存HTMLから最新ファイルを特定
            if (!fullMode && newestExisting === null) {
                const existingFiles = fs.readdirSync(title)
                    .filter(f => f.endsWith('.html'))
                    .sort()
                newestExisting = existingFiles.length > 0
                    ? title + '/' + existingFiles[existingFiles.length - 1].replace(/\.html$/, '')
                    : ''
                if (newestExisting) console.log(`newest existing: ${newestExisting}`)
            }
            const queue = []
            m.forEach(l => {
                l = l.replace(/&amp;/g, "&")
                var name = title + "/" + l.match(/>(.+)/)[1].replace(/[\/:]/g, "")
                var path = l.match(/<a href="(.+?)">/)[1]
                if (!fullMode && fs.existsSync(name + ".html") && name !== newestExisting) {
                    console.log('skip: ' + name)
                    return
                }
                queue.push({ path, name })
            })
            console.log(`room ${room_id} page ${page}: ${queue.length}件取得、${m.length - queue.length}件スキップ`)
            page += 100
            const hasNextPage = m.length >= 100
            processQueue(queue, () => {
                if (hasNextPage) {
                    https.get(url(room_id, page), callback).on('error', errot_callback)
                } else {
                    if (doneCallback) doneCallback();
                }
            })
        });
    }
    https.get(url(room_id, page), callback).on('error', errot_callback);
}

const args = process.argv.slice(2);
const fullMode = args.includes('--full');
const room_id = args.find(a => !a.startsWith('-'));

if (room_id) {
    console.log(room_id + (fullMode ? ' [full mode]' : ' [skip existing]'))
    processRoom(room_id, null, fullMode)
} else {
    // 既存のディレクトリからルームIDを収集して順番に処理する
    const dirs = fs.readdirSync('.').filter(f => {
        try { return fs.statSync(f).isDirectory() && /^\[\d+\]/.test(f); }
        catch (e) { return false; }
    });
    const roomIds = [...new Set(dirs.map(d => d.match(/^\[(\d+)\]/)[1]))];
    console.log('Found rooms: ' + roomIds.join(', ') + (fullMode ? ' [full mode]' : ' [skip existing]'));

    let i = 0;
    function next() {
        if (i >= roomIds.length) {
            console.log('All rooms processed');
            return;
        }
        const rid = roomIds[i++];
        console.log(`Processing room ${rid} (${i}/${roomIds.length})`);
        processRoom(rid, () => setTimeout(next, 5000), fullMode);
    }
    next();
}
