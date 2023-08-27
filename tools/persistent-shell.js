// lifted from https://github.com/joshuatz/nodejs-child-process-testing
// see https://joshuatz.com/posts/2020/keep-a-shell-open-in-nodejs-and-reuse-for-multiple-commands/

// Inspiration: https://github.com/nodejs/node/blob/c1da528bc25c9cc5a8240a7b4f136f5968f6e113/lib/child_process.js#L485-L509
const getShellProc = (shell) => {
	let shellFile = '/bin/sh';
	if (process.platform === 'win32') {
		shellFile = process.env.comspec || 'cmd.exe';
	} else if (process.platform === 'android') {
		shellFile = '/system/bin/sh'
	}

	shellFile = shell || shellFile;

	// Spawn the proc and return
	return require('child_process').spawn(shellFile, {
		shell: false,
	});
}

const getPersistentShell = (shell) => {
	const shellProc = getShellProc(shell);
	/** @type {string[]} */
	let chunks = [];
	const dataListeners = [];
	const errorListeners = [];
	const exitListeners = [];

	shellProc.stdout.on('data', data => {
		data = data.toString();
		chunks.push(data);
		dataListeners.forEach(f => f(data));
	});
	shellProc.on('exit', exitCode => {
		if (exitCode === 0) {
			exitListeners.forEach(f => f(chunks.join('')));
		} else {
			errorListeners.forEach(f => f(chunks.join('')));
		}
	});
	shellProc.on('error', err => errorListeners.forEach(f => f(err)));

	const awaitableResult = new Promise((res, rej) => {
		errorListeners.push(rej);
		exitListeners.push(res);
	});

	/**
	 * Execute a command
	 * @param {string} cmd
	 * @param {number} dataLength
	 */
	const execCmd = async (cmd, dataLength = 1, capture = true) => {
		let result = null;
		if (capture) {
			const cmdResChunks = [];
			result = new Promise((res, rej) => {
				dataListeners.push((data) => {
					cmdResChunks.push(data.toString());
					if (cmdResChunks.length >= dataLength) {
						res(cmdResChunks.join(''));
					}
				});
			});
		}
		cmd = cmd.endsWith('\n') ? cmd : (cmd + '\n');
		shellProc.stdin.write(cmd);
		return result;
	}

	const execCmdWithoutCapture = (cmd, dataLength) => {
		execCmd(cmd, dataLength, false);
		return null;
	}

	return {
		process: shellProc,
		finalResult: awaitableResult,
		execCmd,
		execCmdWithoutCapture
	}
}

module.exports = {
	getPersistentShell
}
