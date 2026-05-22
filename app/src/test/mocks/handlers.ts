import { http, HttpResponse } from 'msw'

export const authHandlers = [
  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      id: 1,
      email: 'user@example.com',
      name: 'Test User',
      role: 'developer',
      is_first_login: false,
    })
  }),

  http.get('/api/auth/me/capabilities', () => {
    return HttpResponse.json({
      capabilities: [],
    })
  }),
]

export const projectHandlers = [
  http.get('/api/projects/', () => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Project Alpha',
        description: 'First test project',
        key_prefix: 'PA',
        status: 'active',
        created_at: '2026-01-01T00:00:00',
        work_item_stats: {
          total: 5,
          by_status: { todo: 2, in_progress: 2, done: 1 },
          total_points: 13,
          completed: 1,
          completion_pct: 20,
        },
        developers: [],
      },
      {
        id: 2,
        name: 'Project Beta',
        description: 'Second test project',
        key_prefix: 'PB',
        status: 'active',
        created_at: '2026-01-15T00:00:00',
        work_item_stats: {
          total: 3,
          by_status: { todo: 1, in_progress: 1, done: 1 },
          total_points: 8,
          completed: 1,
          completion_pct: 33,
        },
        developers: [],
      },
    ])
  }),

  http.get('/api/personal-tasks/', () => {
    return HttpResponse.json([
      {
        id: 1,
        title: 'Setup test environment',
        description: 'Configure testing infrastructure',
        priority: 'high',
        status: 'todo',
        due_date: '2026-06-01',
        estimated_hours: 4,
        is_converted: false,
      },
    ])
  }),

  http.get('/api/workitems/my-tasks', () => {
    return HttpResponse.json([
      {
        id: 'TASK-1',
        key: 'TASK-1',
        title: 'Review PR',
        description: 'Review the pull request',
        status: 'in_progress',
        is_overdue: false,
        due_date: '2026-06-01',
      },
    ])
  }),
]

export const projectBoardHandlers = [
  http.get('/api/projects/:projectId', () => {
    return HttpResponse.json({
      id: 1,
      name: 'Test Project',
      description: 'Test project for board',
      key_prefix: 'TEST',
      status: 'active',
      created_at: '2026-01-01T00:00:00',
      work_item_stats: {
        total: 3,
        by_status: { todo: 1, in_progress: 1, done: 1 },
        total_points: 13,
        completed: 1,
        completion_pct: 33,
      },
      developers: [
        { id: 1, name: 'Alice', email: 'alice@example.com', role: 'developer' },
        { id: 2, name: 'Bob', email: 'bob@example.com', role: 'developer' },
      ],
    })
  }),

  http.get('/api/workitems/board', () => {
    return HttpResponse.json([
      {
        id: '1',
        key: 'TEST-1',
        type: 'user_story',
        title: 'First Story',
        description: 'First story description',
        status: 'todo',
        assigned_hours: 16,
        remaining_hours: 16,
        logged_hours: 0,
        story_points: 4,
        priority: 'high',
        assignee: 'Alice',
        assignee_id: 1,
        sprint: 'Sprint 1',
        sprint_id: 1,
        product_id: '1',
        tags: ['backend'],
        epic: '',
      },
      {
        id: '2',
        key: 'TEST-2',
        type: 'task',
        title: 'Second Task',
        description: 'Second task description',
        status: 'in_progress',
        assigned_hours: 8,
        remaining_hours: 4,
        logged_hours: 4,
        story_points: 0,
        priority: 'medium',
        assignee: 'Bob',
        assignee_id: 2,
        sprint: 'Sprint 1',
        sprint_id: 1,
        product_id: '1',
        tags: ['frontend'],
        epic: '',
      },
      {
        id: '3',
        key: 'TEST-3',
        type: 'bug',
        title: 'Third Bug',
        description: 'Third bug description',
        status: 'done',
        assigned_hours: 4,
        remaining_hours: 0,
        logged_hours: 4,
        story_points: 0,
        priority: 'critical',
        assignee: '',
        assignee_id: null,
        sprint: 'Sprint 2',
        sprint_id: 2,
        product_id: '1',
        tags: [],
        epic: '',
      },
    ])
  }),

  http.get('/api/workitems/projects/:projectId/sprints', () => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Sprint 1',
        goal: 'Initial sprint',
        status: 'active',
        start_date: '2026-05-01',
        end_date: '2026-05-15',
        capacity_hours: 40,
        velocity: 8,
        total_items: 2,
        todo_count: 1,
        in_progress_count: 1,
        done_count: 0,
        total_points: 4,
        completed_points: 0,
        completion_pct: 0,
      },
      {
        id: 2,
        name: 'Sprint 2',
        goal: 'Second sprint',
        status: 'upcoming',
        start_date: '2026-05-16',
        end_date: '2026-05-31',
        capacity_hours: 40,
        velocity: 0,
        total_items: 1,
        todo_count: 0,
        in_progress_count: 0,
        done_count: 1,
        total_points: 0,
        completed_points: 0,
        completion_pct: 100,
      },
    ])
  }),

  http.get('/api/developers/', () => {
    return HttpResponse.json([
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ])
  }),

  http.get('/api/comments/workitem/:itemId', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/workitems/:itemId', () => {
    return HttpResponse.json({
      id: '1',
      key: 'TEST-1',
      type: 'user_story',
      title: 'First Story',
      description: 'First story description',
      status: 'todo',
      assigned_hours: 16,
      remaining_hours: 16,
      logged_hours: 0,
      story_points: 4,
      priority: 'high',
      assignee: 'Alice',
      assignee_id: 1,
      sprint: 'Sprint 1',
      sprint_id: 1,
      product_id: '1',
      tags: ['backend'],
      epic: '',
    })
  }),
]

export const adminHandlers = [
  http.get('/api/admin/stats', () => {
    return HttpResponse.json({
      total_employees: 5,
      total_projects: 3,
      total_tickets: 42,
      active_sprints: 2,
      tickets_by_status: { todo: 20, in_progress: 15, done: 7 },
      tickets_by_priority: { high: 10, medium: 20, low: 12 },
    })
  }),

  http.get('/api/admin/employees', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/admin/developers/capacity', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/admin/projects', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/auth/admin/users', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/auth/admin/roles', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/auth/capabilities', () => {
    return HttpResponse.json([])
  }),
]

export const handlers = [
  http.get('/api/health', () => {
    return HttpResponse.json({ status: 'ok' })
  }),
  ...authHandlers,
  ...projectHandlers,
  ...projectBoardHandlers,
  ...adminHandlers,
]
