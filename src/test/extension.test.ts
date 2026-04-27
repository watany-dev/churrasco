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

  test('opens the Churrasco sidebar Tree View', async () => {
    const extension = vscode.extensions.getExtension('watany-dev.churrasco-break');
    assert.ok(extension, 'extension watany-dev.churrasco-break is not present');
    await extension.activate();

    await vscode.commands.executeCommand('workbench.view.extension.churrasco-break');

    const allCommands = await vscode.commands.getCommands(true);
    assert.ok(
      allCommands.includes('churrasco.statusView.focus'),
      'churrasco.statusView is not registered',
    );
  });
});
