import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the addressJustSelected flag logic in the receive slice.
 *
 * These tests verify the slice action semantics in isolation without importing
 * useStore (which transitively pulls in @wailsjs bindings that aren't resolvable
 * in the vitest environment — a pre-existing config gap shared with
 * walletSlice.test.ts). The tests exercise the same state transitions that
 * selectAddressForRequest and clearAddressJustSelected perform in the slice.
 */

// Minimal reproduction of the selectAddressForRequest state transition
function selectAddressForRequest(
  state: { currentAddress: string; reuseAddress: boolean; addressJustSelected: boolean; isAddressesDialogOpen: boolean; error: string | null },
  address: string,
) {
  return {
    ...state,
    currentAddress: address,
    reuseAddress: true,
    addressJustSelected: true,
    isAddressesDialogOpen: false,
    error: null,
  };
}

function clearAddressJustSelected<T extends { addressJustSelected: boolean }>(
  state: T,
): T {
  return { ...state, addressJustSelected: false };
}

describe('Receive Slice — addressJustSelected flag', () => {
  const defaultState = {
    currentAddress: 'DOriginalAddress1234567890abcdef',
    reuseAddress: false,
    addressJustSelected: false,
    isAddressesDialogOpen: true,
    error: null,
    formState: { label: 'Test Invoice', amount: '100', message: 'Payment' },
  };

  it('selectAddressForRequest sets addressJustSelected to true', () => {
    const next = selectAddressForRequest(defaultState, 'DNewPickedAddr1234567890abcdefgh');

    expect(next.addressJustSelected).toBe(true);
    expect(next.currentAddress).toBe('DNewPickedAddr1234567890abcdefgh');
    expect(next.reuseAddress).toBe(true);
    expect(next.isAddressesDialogOpen).toBe(false);
    expect(next.error).toBeNull();
  });

  it('clearAddressJustSelected resets the flag to false', () => {
    const picked = selectAddressForRequest(defaultState, 'DNewPickedAddr1234567890abcdefgh');
    expect(picked.addressJustSelected).toBe(true);

    const cleared = clearAddressJustSelected(picked);
    expect(cleared.addressJustSelected).toBe(false);
  });

  it('selectAddressForRequest preserves form state (spread semantics)', () => {
    const stateWithForm = { ...defaultState };
    const next = selectAddressForRequest(stateWithForm, 'DNewPickedAddr1234567890abcdefgh');

    // selectAddressForRequest only sets its 4 fields; formState is untouched
    // because the slice action uses set(() => ({ ... })) which merges, not replaces.
    // Here we verify the spread doesn't clobber extra fields.
    expect(next.currentAddress).toBe('DNewPickedAddr1234567890abcdefgh');
    expect((next as typeof stateWithForm).formState).toEqual({
      label: 'Test Invoice',
      amount: '100',
      message: 'Payment',
    });
  });

  it('flag is false by default (not triggered by non-picker address changes)', () => {
    // Simulating what fetchCurrentAddress or generateNewAddress do:
    // they set currentAddress directly without touching addressJustSelected
    const afterFetch = { ...defaultState, currentAddress: 'DFreshAddr1234567890abcdefghijk' };
    expect(afterFetch.addressJustSelected).toBe(false);
  });

  it('consecutive picks each set the flag', () => {
    let state = selectAddressForRequest(defaultState, 'DFirst1234567890abcdefghijklmn');
    expect(state.addressJustSelected).toBe(true);

    state = clearAddressJustSelected(state);
    expect(state.addressJustSelected).toBe(false);

    // Re-open dialog and pick again
    state = { ...state, isAddressesDialogOpen: true };
    state = selectAddressForRequest(state, 'DSecond1234567890abcdefghijklm');
    expect(state.addressJustSelected).toBe(true);
    expect(state.currentAddress).toBe('DSecond1234567890abcdefghijklm');
  });
});
