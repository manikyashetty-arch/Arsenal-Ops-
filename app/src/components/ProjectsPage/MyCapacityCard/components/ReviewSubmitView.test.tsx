/**
 * Component tests for the dev Review-and-Submit modal view.
 *
 * MSW intercepts the two endpoints at the wire, so the component's real
 * react-query + apiFetch pipeline runs unmodified — only the server is
 * fake. Per-test handler overrides script success/partial/empty paths
 * (see docs/frontend-testing-guide.md §3).
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { MyTimesheetResponse, SubmitTimesheetResponse } from '@/client';
import { server } from '@/mocks/node';
import { API_BASE } from '@/mocks/handlers/constants';
import { renderWithQueryClient } from '@/test-utils/render';
import ReviewSubmitView from './ReviewSubmitView';

const onBackNoop = () => {};

const baseTimesheet: MyTimesheetResponse = {
  week_start: '2026-06-22',
  week_end: '2026-06-26',
  total_hours: 12,
  syncable_unsubmitted_count: 3,
  clients: [
    {
      qb_customer_id: 'QB-1',
      client_name: 'Acme Co',
      subtotal_hours: 12,
      projects: [
        {
          project_id: 7,
          project_name: 'Acme Mobile',
          subtotal_hours: 12,
          entries: [
            {
              id: 101,
              logged_at: '2026-06-22',
              hours: 4,
              description: 'Auth wiring',
              submitted_at: null,
              work_item_title: null,
              synced: false,
            },
            {
              id: 102,
              logged_at: '2026-06-23',
              hours: 5,
              description: 'Onboarding screens',
              submitted_at: null,
              work_item_title: null,
              synced: false,
            },
            {
              id: 103,
              logged_at: '2026-06-24',
              hours: 3,
              description: 'Code review',
              submitted_at: null,
              work_item_title: null,
              synced: false,
            },
          ],
        },
      ],
    },
  ],
  unlinked_projects: [],
};

const seedTimesheet = (data: MyTimesheetResponse) => {
  server.use(http.get(`${API_BASE}/developers/me/timesheet`, () => HttpResponse.json(data)));
};

const seedSubmit = (response: SubmitTimesheetResponse | (() => Response)) => {
  server.use(
    http.post(`${API_BASE}/developers/me/timesheet/submit`, () =>
      typeof response === 'function' ? response() : HttpResponse.json(response),
    ),
  );
};

describe('<ReviewSubmitView />', () => {
  it('renders Mon-Fri day cards with the nested client → project → entry split', async () => {
    seedTimesheet(baseTimesheet);
    renderWithQueryClient(<ReviewSubmitView onBack={onBackNoop} />);

    // The fixture spans Mon (2026-06-22), Tue (06-23), Wed (06-24).
    // All five weekday cards render (empty days included).
    expect(await screen.findByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Tuesday')).toBeInTheDocument();
    expect(screen.getByText('Wednesday')).toBeInTheDocument();
    expect(screen.getByText('Thursday')).toBeInTheDocument();
    expect(screen.getByText('Friday')).toBeInTheDocument();

    // Client + project nest inside each day that has entries — Acme Co
    // appears once per populated day (3 occurrences) PLUS once in the
    // weekly summary legend at the top of the scroll area.
    expect(screen.getAllByText('Acme Co')).toHaveLength(4);
    expect(screen.getAllByText('Acme Mobile')).toHaveLength(3);

    // Weekly summary legend lives in the pinned area, just below the
    // submit button. Per-client total surfaces in the legend.
    const legendHours = screen.getAllByText('12h');
    expect(legendHours.length).toBeGreaterThanOrEqual(1);

    // Each entry's description renders on its own day card.
    expect(screen.getByText('Auth wiring')).toBeInTheDocument();
    expect(screen.getByText('Onboarding screens')).toBeInTheDocument();
    expect(screen.getByText('Code review')).toBeInTheDocument();

    expect(screen.getByText(/total this week/i)).toBeInTheDocument();
    expect(screen.getByText(/3 ready to submit/i)).toBeInTheDocument();
  });

  it('renders an "Unlinked projects" section when present', async () => {
    seedTimesheet({
      ...baseTimesheet,
      unlinked_projects: [
        {
          project_id: 12,
          project_name: 'Internal Tools',
          subtotal_hours: 4,
          entries: [
            {
              id: 200,
              logged_at: '2026-06-22',
              hours: 4,
              description: 'Refactor admin',
              submitted_at: null,
              work_item_title: null,
              synced: false,
            },
          ],
        },
      ],
    });
    renderWithQueryClient(<ReviewSubmitView onBack={onBackNoop} />);

    // The headline carries the count of unlinked projects ("N unlinked
    // project(s)"). The pinned chip in the submit bar ALSO says "won't
    // sync" — finding it by "1 unlinked project" disambiguates from both.
    expect(await screen.findByText(/1 unlinked project/i)).toBeInTheDocument();
    expect(screen.getByText('Internal Tools')).toBeInTheDocument();
    expect(screen.getByText(/aren't linked to a QuickBooks customer/i)).toBeInTheDocument();
  });

  it('disables the Submit button when syncable_unsubmitted_count is 0', async () => {
    seedTimesheet({ ...baseTimesheet, syncable_unsubmitted_count: 0 });
    renderWithQueryClient(<ReviewSubmitView onBack={onBackNoop} />);
    const button = await screen.findByRole('button', { name: /Submit & Sync to QuickBooks/i });
    expect(button).toBeDisabled();
  });

  it('shows the full-success banner when all entries sync', async () => {
    seedTimesheet(baseTimesheet);
    seedSubmit({
      status: 'ok',
      submitted_count: 3,
      synced_count: 3,
      failed: [],
      week_start: '2026-06-22',
      week_end: '2026-06-26',
      reason: null,
    });
    const { user } = renderWithQueryClient(<ReviewSubmitView onBack={onBackNoop} />);

    const button = await screen.findByRole('button', { name: /Submit & Sync to QuickBooks/i });
    await user.click(button);

    expect(await screen.findByText(/All 3 entries synced to QuickBooks/i)).toBeInTheDocument();
  });

  it('shows the partial-failure banner and per-row error when some entries fail', async () => {
    seedTimesheet(baseTimesheet);
    seedSubmit({
      status: 'partial',
      submitted_count: 3,
      synced_count: 1,
      failed: [
        { entry_id: 102, error: 'QuickBooks rejected: invalid hours' },
        { entry_id: 103, error: 'QuickBooks rejected: customer not found' },
      ],
      week_start: '2026-06-22',
      week_end: '2026-06-26',
      reason: null,
    });
    const { user } = renderWithQueryClient(<ReviewSubmitView onBack={onBackNoop} />);

    const button = await screen.findByRole('button', { name: /Submit & Sync to QuickBooks/i });
    await user.click(button);

    expect(await screen.findByText(/1 of 3 entries synced/i)).toBeInTheDocument();
    // Each failing row carries its own error message inline.
    expect(await screen.findByText(/invalid hours/i)).toBeInTheDocument();
    expect(screen.getByText(/customer not found/i)).toBeInTheDocument();
  });

  it('shows the total-failure banner when the submit endpoint returns an HTTP error', async () => {
    seedTimesheet(baseTimesheet);
    seedSubmit(() => HttpResponse.json({ detail: 'QuickBooks not connected' }, { status: 503 }));
    const { user } = renderWithQueryClient(<ReviewSubmitView onBack={onBackNoop} />);

    const button = await screen.findByRole('button', { name: /Submit & Sync to QuickBooks/i });
    await user.click(button);

    expect(await screen.findByText(/QuickBooks not connected/i)).toBeInTheDocument();
  });

  it('renders "Synced" badge for synced entries and "Submitted" for in-flight ones', async () => {
    seedTimesheet({
      ...baseTimesheet,
      syncable_unsubmitted_count: 0,
      clients: [
        {
          qb_customer_id: 'QB-1',
          client_name: 'Acme Co',
          subtotal_hours: 8,
          projects: [
            {
              project_id: 7,
              project_name: 'Acme Mobile',
              subtotal_hours: 8,
              entries: [
                {
                  id: 201,
                  logged_at: '2026-06-22',
                  hours: 4,
                  description: 'Already synced',
                  submitted_at: '2026-06-23T09:00:00',
                  work_item_title: null,
                  synced: true,
                },
                {
                  id: 202,
                  logged_at: '2026-06-23',
                  hours: 4,
                  description: 'In flight',
                  submitted_at: '2026-06-23T10:00:00',
                  work_item_title: null,
                  synced: false,
                },
              ],
            },
          ],
        },
      ],
    });
    renderWithQueryClient(<ReviewSubmitView onBack={onBackNoop} />);

    await waitFor(() => {
      expect(screen.getByText('Synced')).toBeInTheDocument();
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });
  });

  it('renders an empty state when the dev has logged nothing this week', async () => {
    seedTimesheet({
      week_start: '2026-06-22',
      week_end: '2026-06-26',
      total_hours: 0,
      syncable_unsubmitted_count: 0,
      clients: [],
      unlinked_projects: [],
    });
    renderWithQueryClient(<ReviewSubmitView onBack={onBackNoop} />);

    expect(await screen.findByText(/Nothing logged this week yet/i)).toBeInTheDocument();
  });

  it('falls back to the work-item title when an entry has no description', async () => {
    seedTimesheet({
      ...baseTimesheet,
      syncable_unsubmitted_count: 1,
      clients: [
        {
          qb_customer_id: 'QB-1',
          client_name: 'Acme Co',
          subtotal_hours: 4,
          projects: [
            {
              project_id: 7,
              project_name: 'Acme Mobile',
              subtotal_hours: 4,
              entries: [
                {
                  id: 301,
                  logged_at: '2026-06-22',
                  hours: 4,
                  description: null,
                  work_item_title: 'Refactor auth flow',
                  submitted_at: null,
                  synced: false,
                },
              ],
            },
          ],
        },
      ],
    });
    renderWithQueryClient(<ReviewSubmitView onBack={onBackNoop} />);

    // Ticket title surfaces in place of the missing description.
    expect(await screen.findByText('Refactor auth flow')).toBeInTheDocument();
  });

  it('calls onBack when the Back button is clicked', async () => {
    seedTimesheet(baseTimesheet);
    let called = false;
    const { user } = renderWithQueryClient(
      <ReviewSubmitView
        onBack={() => {
          called = true;
        }}
      />,
    );
    // Wait for any rendered day card so the view is past its loading state.
    await screen.findByText('Monday');
    await user.click(screen.getByRole('button', { name: /Back to capacity summary/i }));
    expect(called).toBe(true);
  });
});
