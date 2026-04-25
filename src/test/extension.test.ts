import * as assert from 'node:assert';
import * as vscode from 'vscode';

suite('Extension activation', () => {
  test('registers churrasco.startSession command', async () => {
    const extension = vscode.extensions.getExtension('watany-dev.churrasco-break');
    assert.ok(extension, 'extension watany-dev.churrasco-break is not present');

    await extension.activate();

    const allCommands = await vscode.commands.getCommands(true);
    assert.ok(
      allCommands.includes('churrasco.startSession'),
      'churrasco.startSession is not registered',
    );
  });
});
