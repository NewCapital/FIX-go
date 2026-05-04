import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Banner } from '../Banner';

describe('Banner', () => {
  it('renders message text', () => {
    render(<Banner variant="warning" message="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('applies warning palette and uses status role by default', () => {
    render(<Banner variant="warning" message="Warn" />);
    const el = screen.getByRole('status');
    expect(el).toHaveStyle({ color: 'rgb(255, 153, 102)' });
  });

  it('applies error palette and uses alert role by default', () => {
    render(<Banner variant="error" message="Error" />);
    const el = screen.getByRole('alert');
    expect(el).toHaveStyle({ color: 'rgb(255, 102, 102)' });
  });
});
