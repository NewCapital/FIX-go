import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconButton } from '../IconButton';

describe('IconButton', () => {
  it('renders with aria-label and icon', () => {
    render(
      <IconButton
        ariaLabel="Copy address"
        title="Copy"
        icon={<span data-testid="icon">x</span>}
        onClick={() => {}}
      />,
    );
    expect(screen.getByLabelText('Copy address')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(
      <IconButton ariaLabel="Copy" title="Copy" icon={<span />} onClick={onClick} />,
    );
    fireEvent.click(screen.getByLabelText('Copy'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(
      <IconButton
        ariaLabel="Copy"
        title="Copy"
        icon={<span />}
        onClick={onClick}
        disabled
      />,
    );
    const button = screen.getByLabelText('Copy');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
