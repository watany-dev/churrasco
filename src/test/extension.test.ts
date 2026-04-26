import * as assert from 'node:assert';
import * as vscode from 'vscode';

suite('Extension activation', () => {
  test('registers churrasco session commands', async () => {
    const extension = vscode.extensions.getExtension('watany-dev.churrasco-break');
    assert.ok(extension, 'extension watany-dev.churrasco-break is not present');

    await extension.activate();

    const allCommands = await vscode.commands.getCommands(true);
    for (const id of [
      'churrasco.startSession',
      'churrasco.stopSession',
      'churrasco.pauseSession',
      'churrasco.openMenu',
      'churrasco.eatCurrentMeat',
      'churrasco.passCurrentMeat',
    ]) {
      assert.ok(allCommands.includes(id), `${id} is not registered`);
    }
  });
});
