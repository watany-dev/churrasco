import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => {
  class FakeTreeItem {
    label: string;
    description: string | undefined;
    collapsibleState: number;
    constructor(label: string, collapsibleState: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  }
  return {
    TreeItem: FakeTreeItem,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  };
});

import { TreeItemCollapsibleState } from 'vscode';
import { ChurrascoTreeItem } from './ChurrascoTreeItem';
import type { SidebarSectionNode } from './buildSidebarSections';

describe('ChurrascoTreeItem', () => {
  it('renders a section node as Expanded with its children retained', () => {
    const section: SidebarSectionNode = {
      kind: 'section',
      id: 'status',
      label: 'Service status',
      children: [{ kind: 'leaf', label: '🛑 Stopped' }],
    };
    const item = new ChurrascoTreeItem(section);
    expect(item.label).toBe('Service status');
    expect(item.collapsibleState).toBe(TreeItemCollapsibleState.Expanded);
    expect(item.children).toEqual(section.children);
  });

  it('renders a leaf node as None with its description applied', () => {
    const item = new ChurrascoTreeItem({
      kind: 'leaf',
      label: 'Picanha',
      description: 'x3',
    });
    expect(item.label).toBe('Picanha');
    expect(item.collapsibleState).toBe(TreeItemCollapsibleState.None);
    expect(item.description).toBe('x3');
    expect(item.children).toEqual([]);
  });

  it('leaves description undefined when none is provided', () => {
    const item = new ChurrascoTreeItem({ kind: 'leaf', label: 'Bare leaf' });
    expect(item.description).toBeUndefined();
  });
});
