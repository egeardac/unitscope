// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { wantsLanding } from '../../src/landing/boot';
import { Landing } from '../../src/landing/Landing';
import { loadSkipIntro, saveSkipIntro } from '../../src/state/persistence';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('landing routing', () => {
  it('shows the landing for a bare visit and skips it for shared links', () => {
    expect(wantsLanding('', false)).toBe(true);
    expect(wantsLanding('?q=voltage&v=1&from=V&to=mV', false)).toBe(false);
  });

  it('honours "Skip intro", and ?intro always shows the landing', () => {
    expect(wantsLanding('', true)).toBe(false);
    expect(wantsLanding('?intro', true)).toBe(true);
  });

  it('stores the skip-intro preference', () => {
    expect(loadSkipIntro()).toBe(false);
    saveSkipIntro(true);
    expect(loadSkipIntro()).toBe(true);
    saveSkipIntro(false);
    expect(loadSkipIntro()).toBe(false);
  });
});

describe('Landing', () => {
  it('opens the workspace from the call to action and saves the skip checkbox', () => {
    let opened = 0;
    render(<Landing onOpen={() => opened++} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Convert a unit.');
    fireEvent.click(screen.getAllByRole('button', { name: /Open Unitscope/ })[0]!);
    expect(opened).toBe(1);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Skip intro next time' }));
    expect(loadSkipIntro()).toBe(true);
  });

  it('lets the visitor pick the scope amplitude', () => {
    render(<Landing onOpen={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '10 V' }));
    expect(screen.getByRole('button', { name: '10 V' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('20.000 V')).toBeTruthy();
  });
});
