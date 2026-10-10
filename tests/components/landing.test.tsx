// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { wantsLanding } from '../../src/landing/boot';
import { Landing } from '../../src/landing/Landing';

afterEach(cleanup);

describe('landing routing', () => {
  it('shows the landing for a bare visit and skips it for shared links', () => {
    expect(wantsLanding('')).toBe(true);
    expect(wantsLanding('?q=voltage&v=1&from=V&to=mV')).toBe(false);
  });
});

describe('Landing', () => {
  it('has a single call to action that opens the workspace', () => {
    let opened = 0;
    render(<Landing onOpen={() => opened++} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Convert a unit.');
    const ctas = screen.getAllByRole('button', { name: /Open Unitscope/ });
    expect(ctas).toHaveLength(1);
    fireEvent.click(ctas[0]!);
    expect(opened).toBe(1);
  });

  it('lets the visitor pick the scope amplitude', () => {
    render(<Landing onOpen={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '10 V' }));
    expect(screen.getByRole('button', { name: '10 V' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('20.000 V')).toBeTruthy();
  });
});
