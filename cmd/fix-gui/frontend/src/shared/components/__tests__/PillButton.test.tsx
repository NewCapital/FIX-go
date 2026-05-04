import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PillButton } from '../PillButton';

describe('PillButton', () => {
  it('renders with aria-label, icon, and label', () => {
    render(
      <PillButton
        ariaLabel="Save image"
        title="Save"
        icon={<span data-testid="icon">i</span>}
        label="Save image"
        onClick={() => {}}
      />,
    );
    expect(screen.getByLabelText('Save image')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Save image')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(
      <PillButton
        ariaLabel="Save"
        title="Save"
        icon={<span />}
        label="Save"
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByLabelText('Save'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(
      <PillButton
        ariaLabel="Save"
        title="Save"
        icon={<span />}
        label="Save"
        onClick={onClick}
        disabled
      />,
    );
    const button = screen.getByLabelText('Save');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
