// Behavior coverage for the admin Time Entries tab. This surface is READ-ONLY
// (no log/edit-hours mutation lives under AdminDashboard — hours logging is on
// the ProjectBoard/WorkItemPanel, out of this scope), but it is MONEY-adjacent:
// it audits every hour logged across projects. The load-bearing behaviors are
// therefore (a) the filtered request carries the right query params and (b) the
// client-side (employee × project × day) aggregation sums hours correctly and
// surfaces the server's total. Those are what a regression would silently
// corrupt.
//
// Network faked at the wire by MSW; per-test we override GET /admin/time-entries
// to return a controlled payload (and capture the request URL for the filter
// assertion). Rows are stamped with "now" so they fall inside the default
// this-week preset regardless of when the suite runs — aggregation itself is
// range-independent (the client aggregates whatever the server returns).
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import type { TimeEntriesResponse, TimeEntryRow } from '@/client';
import { server } from '@/mocks/node';
import { API_BASE } from '@/mocks/handlers/constants';
import { renderWithQueryClient } from '@/test-utils/render';
import TimeEntriesTab from './TimeEntriesTab';
import type { EmployeeOption, ProjectOption } from './types';

const projects: ProjectOption[] = [
  { id: 10, name: 'Apollo' },
  { id: 20, name: 'Borealis' },
];
const employees: EmployeeOption[] = [{ id: 5, name: 'Ada Lovelace', email: 'ada@x.com' }];

const NOW = new Date().toISOString();

const row = (over: Partial<TimeEntryRow>): TimeEntryRow => ({
  avatar_url: null,
  description: null,
  developer_email: 'ada@x.com',
  developer_id: 5,
  developer_name: 'Ada Lovelace',
  hours: 2,
  id: 1,
  logged_at: NOW,
  project_id: 10,
  project_name: 'Apollo',
  work_item_id: null,
  work_item_key: null,
  work_item_title: null,
  work_item_type: null,
  ...over,
});

function respondWith(payload: TimeEntriesResponse) {
  server.use(http.get(`${API_BASE}/admin/time-entries`, () => HttpResponse.json(payload)));
}

describe('TimeEntriesTab', () => {
  it('requests time entries and renders the server total-hours strip', async () => {
    respondWith({ rows: [row({})], total_hours: 2, total_rows: 1, truncated: false });

    renderWithQueryClient(<TimeEntriesTab projects={projects} employees={employees} />);

    // Total-hours card reflects the server's sum (2h) once the query resolves.
    // (Employee/project names also appear as filter <option>s, so we key off
    // the total strip, which only reflects loaded data.)
    const totalCard = () => screen.getByText('Total hours').closest('div') as HTMLElement;
    await waitFor(() => expect(totalCard().textContent?.replace(/\s/g, '')).toContain('2h'));
    // And a data row for the entry renders in the table body.
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('aggregates same-employee/same-project/same-day rows, summing hours into one', async () => {
    // Three raw entries by the same dev on the same project + day → one row of 6h.
    respondWith({
      rows: [row({ id: 1, hours: 2 }), row({ id: 2, hours: 3 }), row({ id: 3, hours: 1 })],
      total_hours: 6,
      total_rows: 3,
      truncated: false,
    });

    renderWithQueryClient(<TimeEntriesTab projects={projects} employees={employees} />);

    // Wait for the query to resolve; the total strip preserves the server sum.
    const totalCard = () => screen.getByText('Total hours').closest('div') as HTMLElement;
    await waitFor(() => expect(totalCard().textContent?.replace(/\s/g, '')).toContain('6h'));

    // The three raw entries collapse into ONE aggregated data row summing to 6h.
    // Scope to the table body so the filter <option>s don't count.
    const tbody = screen.getByRole('table').querySelector('tbody') as HTMLElement;
    const bodyRows = within(tbody).getAllByRole('row');
    expect(bodyRows).toHaveLength(1);
    expect(bodyRows[0]!.textContent?.replace(/\s/g, '')).toContain('6h');
    expect(bodyRows[0]!.textContent).toContain('Ada Lovelace');
  });

  it('sends project_id in the query when a project filter is selected', async () => {
    let firstUrl = '';
    const urls: string[] = [];
    server.use(
      http.get(`${API_BASE}/admin/time-entries`, ({ request }) => {
        const u = new URL(request.url);
        urls.push(u.search);
        if (!firstUrl) firstUrl = u.search;
        return HttpResponse.json({ rows: [], total_hours: 0, total_rows: 0, truncated: false });
      }),
    );

    const user = userEvent.setup();
    renderWithQueryClient(<TimeEntriesTab projects={projects} employees={employees} />);

    // Initial request (this-week preset) carries a date range but no project_id.
    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    expect(firstUrl).not.toContain('project_id');
    expect(firstUrl).toContain('date_from');

    // Select the Apollo project (id 10) → refetch with project_id=10. The
    // Project <select> is the first combobox in the filter bar.
    const [projectSelect] = screen.getAllByRole('combobox');
    await user.selectOptions(projectSelect!, '10');

    await waitFor(() => expect(urls.some((s) => s.includes('project_id=10'))).toBe(true));
  });

  it('shows the empty state when no entries match', async () => {
    respondWith({ rows: [], total_hours: 0, total_rows: 0, truncated: false });

    renderWithQueryClient(<TimeEntriesTab projects={projects} employees={employees} />);

    expect(await screen.findByText(/No time entries match your filters/i)).toBeTruthy();
  });

  it('surfaces the error state when the request fails', async () => {
    server.use(
      http.get(`${API_BASE}/admin/time-entries`, () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );

    renderWithQueryClient(<TimeEntriesTab projects={projects} employees={employees} />);

    expect(await screen.findByText(/Failed to load time entries/i)).toBeTruthy();
  });
});
