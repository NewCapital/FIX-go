import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPill } from '../StatusPill';

describe('StatusPill', () => {
  it('renders the label text', () => {
    render(<StatusPill tone="success" label="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies the success tone color #27ae60', () => {
    render(<StatusPill tone="success" label="Active" />);
    expect(screen.getByText('Active')).toHaveStyle({ color: 'rgb(39, 174, 96)' });
  });

  it('applies the warning tone color #ff9966', () => {
    render(<StatusPill tone="warning" label="Enabled" />);
    expect(screen.getByText('Enabled')).toHaveStyle({ color: 'rgb(255, 153, 102)' });
  });

  it('applies the error tone color #ff6666', () => {
    render(<StatusPill tone="error" label="Locked" />);
    expect(screen.getByText('Locked')).toHaveStyle({ color: 'rgb(255, 102, 102)' });
  });

  it('applies the neutral tone color #888888', () => {
    render(<StatusPill tone="neutral" label="Disabled" />);
    expect(screen.getByText('Disabled')).toHaveStyle({ color: 'rgb(136, 136, 136)' });
  });
});
