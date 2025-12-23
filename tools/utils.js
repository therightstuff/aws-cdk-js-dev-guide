const fs = require('node:fs');
const readline = require('node:readline');

let rl;

function getRl() {
    if (rl) return rl;

    let input = process.stdin;
    // If stdin is not a TTY (e.g. when piping curl | node), try to read from /dev/tty
    if (!process.stdin.isTTY && process.platform !== 'win32') {
        try {
            const tty = fs.openSync('/dev/tty', 'r');
            input = fs.createReadStream(null, { fd: tty });
        // eslint-disable-next-line no-unused-vars
        } catch (err) {
            // Fallback to stdin if /dev/tty cannot be opened
        }
    }

    rl = readline.createInterface({
        input: input,
        output: process.stdout,
    });
    return rl;
}

function askQuestion(query) {
    return new Promise(resolve => getRl().question(query, ans => {
        resolve(ans);
        closeRl();
    }));
}

function closeRl() {
    if (rl) {
        rl.close();
        // If we created a custom stream from /dev/tty, we need to destroy it
        // to release the file descriptor and stop reading.
        if (rl.input !== process.stdin) {
            rl.input.destroy();
        }
        rl = null;
    }
}

module.exports = {
    askQuestion,
};
