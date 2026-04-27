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
      'churrasco.showTodayLog',
      'churrasco.resetToday',
    ]) {
      assert.ok(allCommands.includes(id), `${id} is not registered`);
    }
  });

  test('contributes all churrasco configuration keys with defaults', () => {
    const config = vscode.workspace.getConfiguration('churrasco');
    const expected: Array<{ key: string; defaultValue: unknown }> = [
      { key: 'intervalMinutes', defaultValue: 10 },
      { key: 'enableNotifications', defaultValue: true },
      { key: 'showStatusBar', defaultValue: true },
      { key: 'pauseWhenInactive', defaultValue: false },
      { key: 'maxSatiety', defaultValue: 100 },
      { key: 'autoStopWhenFull', defaultValue: true },
      { key: 'locale', defaultValue: 'ja' },
    ];
    for (const { key, defaultValue } of expected) {
      const inspected = config.inspect(key);
      assert.ok(inspected, `churrasco.${key} is not contributed`);
      assert.strictEqual(
        inspected.defaultValue,
        defaultValue,
        `churrasco.${key} default should be ${String(defaultValue)}`,
      );
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
