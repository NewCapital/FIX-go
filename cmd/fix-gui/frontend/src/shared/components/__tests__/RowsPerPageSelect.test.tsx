import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RowsPerPageSelect } from '../RowsPerPageSelect';

describe('RowsPerPageSelect', () => {
  const OPTIONS = [25, 50, 100, 250] as const;

  it('renders the current value in the trigger button', () => {
    render(
      <RowsPerPageSelect
        value={50}
        options={OPTIONS}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Rows per page: 50/ })).toHaveTextContent('50');
  });

  it('opens the listbox on click and lists all options', () => {
    render(
      <RowsPerPageSelect
        value={25}
        options={OPTIONS}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Rows per page: 25/ }));
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();
    const opts = screen.getAllByRole('option');
    expect(opts).toHaveLength(4);
    expect(opts.map((o) => o.textContent)).toEqual(['25', '50', '100', '250']);
  });

  it('calls onChange with the picked option', () => {
    const onChange = vi.fn();
    render(
      <RowsPerPageSelect
        value={25}
        options={OPTIONS}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Rows per page: 25/ }));
    // commit uses mousedown (not click) to win the race against outside-click
    fireEvent.mouseDown(screen.getByRole('option', { name: '100' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('does not call onChange when the picked option equals current value', () => {
    const onChange = vi.fn();
    render(
      <RowsPerPageSelect
        value={50}
        options={OPTIONS}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Rows per page: 50/ }));
    fireEvent.mouseDown(screen.getByRole('option', { name: '50' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fires onTriggerMouseDown on the trigger button mousedown', () => {
    const onTriggerMouseDown = vi.fn();
    render(
      <RowsPerPageSelect
        value={25}
        options={OPTIONS}
        onChange={() => {}}
        onTriggerMouseDown={onTriggerMouseDown}
      />,
    );
    fireEvent.mouseDown(screen.getByRole('button', { name: /Rows per page: 25/ }));
    expect(onTriggerMouseDown).toHaveBeenCalledTimes(1);
  });

  it('marks the currently-selected option with aria-selected', () => {
    render(
      <RowsPerPageSelect
        value={100}
        options={OPTIONS}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Rows per page: 100/ }));
    expect(screen.getByRole('option', { name: '100' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('option', { name: '25' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });
});
