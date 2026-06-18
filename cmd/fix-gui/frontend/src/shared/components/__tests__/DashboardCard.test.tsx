import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardCard } from '../DashboardCard';

describe('DashboardCard', () => {
  it('renders the title', () => {
    render(
      <DashboardCard title="Balance">
        <div>body</div>
      </DashboardCard>,
    );
    expect(screen.getByText('Balance')).toBeInTheDocument();
  });

  it('renders the children', () => {
    render(
      <DashboardCard title="Sync">
        <div>child content</div>
      </DashboardCard>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('renders the headerRight slot when provided', () => {
    render(
      <DashboardCard title="Balance" headerRight="FIX">
        <div>body</div>
      </DashboardCard>,
    );
    expect(screen.getByText('FIX')).toBeInTheDocument();
  });

  it('omits the headerRight slot when not provided', () => {
    const { container } = render(
      <DashboardCard title="Sync">
        <div>body</div>
      </DashboardCard>,
    );
    // Title + children only — header row should have a single span (the title).
    expect(container.querySelectorAll('span')).toHaveLength(1);
  });
});
