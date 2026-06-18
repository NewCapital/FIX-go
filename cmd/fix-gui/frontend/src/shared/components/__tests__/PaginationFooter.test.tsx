import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaginationFooter } from '../PaginationFooter';

describe('PaginationFooter', () => {
  const OPTIONS = [25, 50, 100, 250] as const;

  const baseProps = {
    rangeStart: 1,
    rangeEnd: 25,
    total: 100,
    currentPage: 1,
    totalPages: 4,
    onPageChange: () => {},
    pageSize: 25 as 25 | 50 | 100 | 250,
    pageSizeOptions: OPTIONS,
    onPageSizeChange: () => {},
  };

  describe('count text', () => {
    it('renders "X–Y of N" without "Showing"/"blocks" suffixes', () => {
      render(<PaginationFooter {...baseProps} />);
      expect(screen.getByText('1–25 of 100')).toBeInTheDocument();
    });

    it('formats large numbers with thousand separators', () => {
      render(
        <PaginationFooter
          {...baseProps}
          rangeStart={1}
          rangeEnd={25}
          total={1740004}
        />,
      );
      expect(screen.getByText('1–25 of 1,740,004')).toBeInTheDocument();
    });

    it('renders filtered form when totalUnfiltered differs from total', () => {
      render(
        <PaginationFooter
          {...baseProps}
          rangeStart={1}
          rangeEnd={25}
          total={100}
          totalUnfiltered={500}
        />,
      );
      expect(
        screen.getByText('1–25 of 100 filtered (500 total)'),
      ).toBeInTheDocument();
    });

    it('omits filtered form when totalUnfiltered equals total', () => {
      render(
        <PaginationFooter
          {...baseProps}
          rangeStart={1}
          rangeEnd={25}
          total={100}
          totalUnfiltered={100}
        />,
      );
      expect(screen.getByText('1–25 of 100')).toBeInTheDocument();
      expect(screen.queryByText(/filtered/)).not.toBeInTheDocument();
    });

    it('renders "0" when total is zero and no filter is active', () => {
      render(
        <PaginationFooter
          {...baseProps}
          rangeStart={0}
          rangeEnd={0}
          total={0}
        />,
      );
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('renders "0 of M" when total is zero but a filter is active', () => {
      render(
        <PaginationFooter
          {...baseProps}
          rangeStart={0}
          rangeEnd={0}
          total={0}
          totalUnfiltered={42}
        />,
      );
      expect(screen.getByText('0 of 42')).toBeInTheDocument();
    });
  });

  describe('page navigation', () => {
    it('renders Prev/Next disabled when totalPages <= 1', () => {
      // Per the 2026-06-01 m-receive-recent-requests-density-pagination-amount
      // task, the page-nav cluster is now always rendered. When totalPages <= 1
      // both buttons should be present in the DOM AND disabled (existing
      // prevDisabled / nextDisabled predicates handle this naturally because
      // currentPage is clamped to 1, so both `currentPage <= 1` and
      // `currentPage >= totalPages` are true).
      render(<PaginationFooter {...baseProps} totalPages={1} />);
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    });

    it('disables the page-input when totalPages <= 1', () => {
      // Same rationale: even though the page-input is rendered for footer-
      // chrome consistency, typing into it makes no sense when there is only
      // one (or zero) pages. The `disabled={isLoading || totalPages <= 1}`
      // guard on the input prevents user interaction.
      render(<PaginationFooter {...baseProps} currentPage={1} totalPages={1} />);
      const input = screen.getByLabelText('Page 1 of 1') as HTMLInputElement;
      expect(input).toBeDisabled();
    });

    it('disables Prev on the first page', () => {
      render(<PaginationFooter {...baseProps} currentPage={1} />);
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();
    });

    it('disables Next on the last page', () => {
      render(<PaginationFooter {...baseProps} currentPage={4} totalPages={4} />);
      expect(screen.getByRole('button', { name: 'Previous page' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    });

    it('fires onPageChange with currentPage - 1 on Prev', () => {
      const onPageChange = vi.fn();
      render(
        <PaginationFooter
          {...baseProps}
          currentPage={3}
          onPageChange={onPageChange}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('fires onPageChange with currentPage + 1 on Next', () => {
      const onPageChange = vi.fn();
      render(
        <PaginationFooter
          {...baseProps}
          currentPage={2}
          onPageChange={onPageChange}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it('disables Prev/Next while isLoading', () => {
      render(
        <PaginationFooter {...baseProps} currentPage={2} isLoading />,
      );
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    });
  });

  describe('page input jump-to-page', () => {
    it('jumps to a valid page on Enter', () => {
      const onPageChange = vi.fn();
      render(
        <PaginationFooter
          {...baseProps}
          currentPage={1}
          totalPages={10}
          onPageChange={onPageChange}
        />,
      );
      const input = screen.getByLabelText('Page 1 of 10') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onPageChange).toHaveBeenCalledWith(5);
    });

    it('clamps an out-of-range value to totalPages', () => {
      const onPageChange = vi.fn();
      render(
        <PaginationFooter
          {...baseProps}
          currentPage={1}
          totalPages={10}
          onPageChange={onPageChange}
        />,
      );
      const input = screen.getByLabelText('Page 1 of 10') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '999' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onPageChange).toHaveBeenCalledWith(10);
    });

    it('clamps a zero/negative input to 1', () => {
      const onPageChange = vi.fn();
      render(
        <PaginationFooter
          {...baseProps}
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />,
      );
      const input = screen.getByLabelText('Page 5 of 10') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('rejects non-numeric input via /^\\d+$/ regex (does not call onPageChange)', () => {
      const onPageChange = vi.fn();
      render(
        <PaginationFooter
          {...baseProps}
          currentPage={3}
          totalPages={10}
          onPageChange={onPageChange}
        />,
      );
      const input = screen.getByLabelText('Page 3 of 10') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '5.5' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('does not fire onPageChange when typed value equals current page (no-op)', () => {
      const onPageChange = vi.fn();
      render(
        <PaginationFooter
          {...baseProps}
          currentPage={3}
          totalPages={10}
          onPageChange={onPageChange}
        />,
      );
      const input = screen.getByLabelText('Page 3 of 10') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '3' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('resets the input on Escape without firing onPageChange', () => {
      const onPageChange = vi.fn();
      render(
        <PaginationFooter
          {...baseProps}
          currentPage={3}
          totalPages={10}
          onPageChange={onPageChange}
        />,
      );
      const input = screen.getByLabelText('Page 3 of 10') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '7' } });
      expect(input.value).toBe('7');
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(input.value).toBe('3');
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });

  describe('rightSlot', () => {
    it('renders the rightSlot content when provided', () => {
      render(
        <PaginationFooter
          {...baseProps}
          rightSlot={<button>Export</button>}
        />,
      );
      expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    });

    it('omits the rightSlot when not provided (empty placeholder still renders for grid symmetry)', () => {
      render(<PaginationFooter {...baseProps} />);
      // No Export button (or any other named non-pagination button) should be present.
      expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    });
  });

  describe('race-safety guarantees', () => {
    it('does NOT fire onPageChange when user types then mousedowns Prev (suppress flag wins blur race)', () => {
      const onPageChange = vi.fn();
      render(
        <PaginationFooter
          {...baseProps}
          currentPage={3}
          totalPages={10}
          onPageChange={onPageChange}
        />,
      );
      const input = screen.getByLabelText('Page 3 of 10') as HTMLInputElement;
      // User types a different page number
      fireEvent.change(input, { target: { value: '7' } });
      // User clicks Prev — mousedown fires BEFORE the input's blur per DOM
      // event order. The suppress flag must be set synchronously so blur
      // sees it and skips committing the typed value.
      const prev = screen.getByRole('button', { name: 'Previous page' });
      fireEvent.mouseDown(prev);
      // Simulate the implicit blur that follows mousedown when focus shifts
      fireEvent.blur(input);
      // At this point onPageChange should NOT have been called with 7 (the
      // typed-but-uncommitted value). Only the subsequent click should fire.
      expect(onPageChange).not.toHaveBeenCalledWith(7);
      // The button's click then fires legitimately
      fireEvent.click(prev);
      expect(onPageChange).toHaveBeenCalledWith(2);
      expect(onPageChange).toHaveBeenCalledTimes(1);
    });

    it('does NOT fire onPageChange when user types then mousedowns Next', () => {
      const onPageChange = vi.fn();
      render(
        <PaginationFooter
          {...baseProps}
          currentPage={3}
          totalPages={10}
          onPageChange={onPageChange}
        />,
      );
      const input = screen.getByLabelText('Page 3 of 10') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '8' } });
      const next = screen.getByRole('button', { name: 'Next page' });
      fireEvent.mouseDown(next);
      fireEvent.blur(input);
      expect(onPageChange).not.toHaveBeenCalledWith(8);
      fireEvent.click(next);
      expect(onPageChange).toHaveBeenCalledWith(4);
      expect(onPageChange).toHaveBeenCalledTimes(1);
    });

    it('does NOT fire onPageChange when user types then mousedowns RowsPerPageSelect trigger', () => {
      const onPageChange = vi.fn();
      const onPageSizeChange = vi.fn();
      render(
        <PaginationFooter
          {...baseProps}
          currentPage={3}
          totalPages={10}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />,
      );
      const input = screen.getByLabelText('Page 3 of 10') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '6' } });
      const trigger = screen.getByRole('button', { name: /Rows per page: 25/ });
      fireEvent.mouseDown(trigger);
      fireEvent.blur(input);
      // Stale-jump suppressed — onPageChange must not have fired with 6
      expect(onPageChange).not.toHaveBeenCalledWith(6);
    });

    it('handles totalPages=0 (empty-result) without crashing or firing onPageChange', () => {
      const onPageChange = vi.fn();
      render(
        <PaginationFooter
          {...baseProps}
          rangeStart={0}
          rangeEnd={0}
          total={0}
          currentPage={1}
          totalPages={0}
          onPageChange={onPageChange}
        />,
      );
      // Per the 2026-06-01 task, Prev/Next render always but are disabled
      // when totalPages <= 1.
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
      // RowsPerPageSelect still renders
      expect(
        screen.getByRole('button', { name: /Rows per page: 25/ }),
      ).toBeInTheDocument();
      // Count line renders "0"
      expect(screen.getByText('0')).toBeInTheDocument();
      // No onPageChange ever fired
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });

  describe('RowsPerPageSelect integration', () => {
    it('always renders RowsPerPageSelect even when totalPages is 1', () => {
      render(<PaginationFooter {...baseProps} totalPages={1} />);
      expect(
        screen.getByRole('button', { name: /Rows per page: 25/ }),
      ).toBeInTheDocument();
    });

    it('calls onPageSizeChange when the user picks a new size', () => {
      const onPageSizeChange = vi.fn();
      render(
        <PaginationFooter
          {...baseProps}
          onPageSizeChange={onPageSizeChange}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /Rows per page: 25/ }));
      fireEvent.mouseDown(screen.getByRole('option', { name: '100' }));
      expect(onPageSizeChange).toHaveBeenCalledWith(100);
    });
  });

  describe('dynamic page-input width', () => {
    // Width formula: `digits * 8 + 20` pixels.
    //   1 digit  → 28px (defensive minimum for totalPages === 0 edge)
    //   3 digits → 44px (preserves the historic 44px for typical small page counts)
    //   4 digits → 52px
    //   5 digits → 60px (fixes the Explorer blocks list 69,812-pages truncation bug)
    //   6 digits → 68px
    // Tests assert via inline `style.width` since vitest's jsdom does not resolve
    // computed styles; the inline style is the implementation surface anyway.

    it('keeps 44px width for 3-digit totalPages (no regression on Transactions footer)', () => {
      render(<PaginationFooter {...baseProps} currentPage={1} totalPages={999} />);
      const input = screen.getByLabelText('Page 1 of 999') as HTMLInputElement;
      expect(input.style.width).toBe('44px');
    });

    it('widens to 52px for 4-digit totalPages', () => {
      render(<PaginationFooter {...baseProps} currentPage={1} totalPages={5000} />);
      const input = screen.getByLabelText('Page 1 of 5000') as HTMLInputElement;
      expect(input.style.width).toBe('52px');
    });

    it('widens to 60px for 5-digit totalPages (the Explorer blocks-list case)', () => {
      render(<PaginationFooter {...baseProps} currentPage={1} totalPages={69812} />);
      const input = screen.getByLabelText('Page 1 of 69812') as HTMLInputElement;
      expect(input.style.width).toBe('60px');
    });

    it('widens to 68px for 6-digit totalPages', () => {
      render(<PaginationFooter {...baseProps} currentPage={1} totalPages={250000} />);
      const input = screen.getByLabelText('Page 1 of 250000') as HTMLInputElement;
      expect(input.style.width).toBe('68px');
    });

    it('computes 36px width for 2-digit totalPages (lower-bound canonical case)', () => {
      // The baseProps default totalPages=4 (1 digit, 28px) and totalPages=10..99
      // (2 digits, 36px) MUST also produce sensible widths.
      render(<PaginationFooter {...baseProps} currentPage={1} totalPages={50} />);
      const input = screen.getByLabelText('Page 1 of 50') as HTMLInputElement;
      expect(input.style.width).toBe('36px');
    });
  });

  // l-receive-pagination-compact-height (2026-06-02): `dense` prop tightens
  // vertical padding without touching horizontal sizing or behavior.
  describe('dense mode', () => {
    it('default (dense=false) renders standard padding tokens', () => {
      const { container } = render(<PaginationFooter {...baseProps} />);
      const grid = container.querySelector('.pagination-footer-grid') as HTMLElement;
      expect(grid.style.padding).toBe('12px 16px');
      const prev = screen.getByLabelText('Previous page') as HTMLButtonElement;
      expect(prev.style.padding).toBe('6px');
      const input = screen.getByLabelText('Page 1 of 4') as HTMLInputElement;
      expect(input.style.padding).toBe('6px');
      const next = screen.getByLabelText('Next page') as HTMLButtonElement;
      expect(next.style.padding).toBe('6px');
    });

    it('dense={true} reduces container, button, and input padding', () => {
      const { container } = render(<PaginationFooter {...baseProps} dense />);
      const grid = container.querySelector('.pagination-footer-grid') as HTMLElement;
      expect(grid.style.padding).toBe('6px 16px');
      const prev = screen.getByLabelText('Previous page') as HTMLButtonElement;
      expect(prev.style.padding).toBe('4px');
      const input = screen.getByLabelText('Page 1 of 4') as HTMLInputElement;
      expect(input.style.padding).toBe('4px 6px');
      const next = screen.getByLabelText('Next page') as HTMLButtonElement;
      expect(next.style.padding).toBe('4px');
    });

    it('dense does not affect horizontal sizing (page-input width unchanged)', () => {
      render(<PaginationFooter {...baseProps} dense currentPage={1} totalPages={50} />);
      const input = screen.getByLabelText('Page 1 of 50') as HTMLInputElement;
      // 2-digit totalPages still yields 36px (formula unchanged by dense).
      expect(input.style.width).toBe('36px');
    });
  });
});
