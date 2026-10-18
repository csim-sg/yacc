import { TestBed } from '@angular/core/testing';

import { ConversationSelectionService } from './conversation-selection.service';

/**
 * ConversationSelectionService spec (AC-ANG-005-2; T2 §3.2
 * `selectedConversations.store` row — session-only; no UI, parity of
 * absence). Semantics mirror the React store exactly, including
 * `deselectAll` clearing the ids.
 */
describe('ConversationSelectionService', () => {
  let service: ConversationSelectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConversationSelectionService);
  });

  it('starts with an empty session-only selection', () => {
    expect(service.selectedIds().size).toBe(0);
    expect(service.isSelectAll()).toBe(false);
    expect(service.getSelectedIds()).toEqual([]);
  });

  it('toggles conversations on and off', () => {
    service.toggleConversation('c1');
    service.toggleConversation('c2');
    expect(service.isSelected('c1')).toBe(true);
    expect(service.isSelected('c2')).toBe(true);

    service.toggleConversation('c1');
    expect(service.isSelected('c1')).toBe(false);
    expect(service.getSelectedIds()).toEqual(['c2']);
  });

  it('selectAll records the ids and the select-all intent', () => {
    service.selectAll(['c1', 'c2', 'c3']);

    expect(service.isSelectAll()).toBe(true);
    expect(service.getSelectedIds()).toEqual(['c1', 'c2', 'c3']);
  });

  it('deselectAll and clearSelection reset both the ids and the intent (React semantics)', () => {
    service.selectAll(['c1', 'c2']);
    service.deselectAll();
    expect(service.selectedIds().size).toBe(0);
    expect(service.isSelectAll()).toBe(false);

    service.selectAll(['c1']);
    service.clearSelection();
    expect(service.selectedIds().size).toBe(0);
    expect(service.isSelectAll()).toBe(false);
  });

  it('holds no persistence: a fresh instance starts empty', () => {
    service.selectAll(['c1']);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(ConversationSelectionService);
    expect(fresh.selectedIds().size).toBe(0);
  });
});
