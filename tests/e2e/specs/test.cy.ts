const session = {
  name: 'Super Admin',
  email: 'root@example.test',
  role: 'super_admin',
  role_label: 'Super Admin',
  is_active: true,
  initials: 'SA',
}

const dashboard = {
  generated_at: '2026-09-11T02:00:00Z',
  summary: {
    products: 42, variants: 120, inventory_quantity: 640, inventory_value: 512000,
    out_of_stock: 2, low_stock: 3, users_total: 88, users_active: 80, users_suspended: 8,
    admins_total: 4, admins_active: 4, admins_suspended: 0, invitations_pending: 1,
    approvals_pending: 2, orders_total: 310, orders_pending: 4, orders_paid: 6, orders_shipped: 3,
    orders_completed: 290, orders_cancelled: 7, orders_today: 5, sales_today: 12400,
    sales_7_days: 84000, sales_total: 4210000,
  },
  sales_trend: [
    { date: '2026-09-05', label: 'Fri', total: 9000 },
    { date: '2026-09-06', label: 'Sat', total: 15000 },
    { date: '2026-09-07', label: 'Sun', total: 4000 },
    { date: '2026-09-08', label: 'Mon', total: 11000 },
    { date: '2026-09-09', label: 'Tue', total: 8000 },
    { date: '2026-09-10', label: 'Wed', total: 14600 },
    { date: '2026-09-11', label: 'Thu', total: 12400 },
  ],
  recent_orders: [
    { id: 91, customer: 'Maria Santos', customer_email: 'maria@example.test', recipient: 'Maria Santos', phone: '09171234567', total: 2500, created_at: '2026-09-11T01:30:00Z', status: 'Paid', status_key: 'paid', payment_method: 'gcash', items_count: 1, address: '1 Street, Quezon City' },
  ],
  recent_activity: [
    { id: 5, action: 'order.updated', event: 'updated', category: 'order', subject: 'Maria Santos', user: 'Super Admin', created_at: '2026-09-11T01:31:00Z' },
  ],
  alerts: [
    { severity: 'critical', title: '2 variant(s) out of stock', body: 'Restock before these products disappear.', route: '/tabs/inventory', icon: 'alert' },
  ],
  badges: { unread_notifications: 2, pending_approvals: 2 },
}

const orderCounts = { all: 3, pending: 1, paid: 1, shipped: 0, completed: 1, cancelled: 0 }
const approvalCounts = { pending: 2, approved: 1, rejected: 0 }
const accountCounts = {
  users: { total: 88, active: 80, suspended: 8 },
  admins: { total: 4, active: 4, suspended: 0 },
  invitations_pending: 1,
  approvals_pending: 2,
}

const order = {
  id: 91, customer: 'Maria Santos', customer_email: 'maria@example.test', recipient: 'Maria Santos',
  phone: '09171234567', total: 2500, created_at: '2026-09-11T01:30:00Z', status: 'Paid', status_key: 'paid',
  payment_method: 'gcash', items_count: 1, address: '1 Street, Quezon City',
}
const orderDetail = {
  ...order,
  items: [{ product: 'Achilles Runner', product_id: 3, size: '9', color: 'Black', quantity: 1, price: 2500, subtotal: 2500 }],
  shipping: { recipient: 'Maria Santos', phone: '09171234567', street: '1 Street', barangay: 'Brgy', city: 'Quezon City', province: 'Metro Manila', postal_code: '1100', latitude: 14.6, longitude: 121.0, map_url: 'https://maps.example.test' },
  payment: { status: 'completed', method: 'gcash', reference: 'pay_123', paid_at: '2026-09-11T01:31:00Z', refund_status: null, refund_label: null, refund_amount: null },
  timeline: [
    { label: 'Order placed', at: '2026-09-11T01:30:00Z', by: 'Maria Santos', status: 'pending', kind: 'log' },
    { label: 'Status changed to Paid', at: '2026-09-11T01:31:00Z', by: null, status: 'paid', kind: 'log' },
  ],
}

function signIn(path: string): void {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('CapacitorStorage.auth_token', 'test-session')
      win.localStorage.setItem('CapacitorStorage.auth_user', JSON.stringify(session))
    },
  })
}

function stubSharedRequests(): void {
  // Badge counts now ship with the dashboard and list payloads, so the only
  // standalone count call left is the unread badge.
  cy.intercept('GET', '**/api/notifications/unread-count', { unread: 2 })
}

describe('Super Admin dashboard', () => {
  beforeEach(() => {
    cy.viewport(390, 844)
    cy.intercept('**/api/**', { statusCode: 503, body: { message: 'Unexpected test request' } })
    stubSharedRequests()
  })

  it('shows the whole system at a glance and links cards to their modules', () => {
    cy.intercept('GET', '**/api/dashboard', dashboard).as('dashboard')
    signIn('/tabs/dashboard')
    cy.wait('@dashboard')

    cy.contains('Hello, Super').should('be.visible')
    cy.contains('2 variant(s) out of stock').should('be.visible')
    cy.contains('Maria Santos').should('be.visible')
    cy.contains('6').should('exist') // paid orders awaiting shipment

    // A dashboard card opens its module.
    cy.intercept('GET', '**/api/orders?status=paid*', { data: [order], current_page: 1, last_page: 1, total: 1, counts: orderCounts }).as('paidOrders')
    cy.contains('button.stat', 'Paid · to ship').click()
    cy.wait('@paidOrders')
    cy.location('pathname').should('equal', '/tabs/orders')
    cy.contains('Maria Santos').should('be.visible')
  })
})

describe('Orders are read-only for the Super Admin', () => {
  beforeEach(() => {
    cy.viewport(390, 844)
    cy.intercept('**/api/**', { statusCode: 503, body: { message: 'Unexpected test request' } })
    stubSharedRequests()
  })

  it('filters by status and opens full order detail without fulfilment actions', () => {
    cy.intercept('GET', '**/api/orders?*', { data: [order], current_page: 1, last_page: 1, total: 1, counts: orderCounts }).as('orders')
    cy.intercept('GET', '**/api/orders/91', orderDetail).as('orderDetail')
    signIn('/tabs/orders')
    cy.wait('@orders')

    cy.contains('button.chip', 'Paid').click()
    cy.wait('@orders').its('request.url').should('contain', 'status=paid')

    cy.contains('button.row', 'Maria Santos').click()
    cy.wait('@orderDetail')
    cy.contains('Achilles Runner').should('be.visible')
    cy.contains('Status changed to Paid').should('be.visible')
    cy.contains('read-only access').should('be.visible')
    cy.contains('Ship Order').should('not.exist')
    cy.contains('Mark as Delivered').should('not.exist')
    cy.screenshot('superadmin-order-detail')
  })

  it('lets the super admin retry a failed order list', () => {
    cy.intercept('GET', '**/api/orders?*', { statusCode: 503, body: { message: 'Temporarily unavailable' } })
    signIn('/tabs/orders')
    cy.contains('Temporarily unavailable').should('be.visible')
    cy.intercept('GET', '**/api/orders?*', { data: [], current_page: 1, last_page: 1, total: 0, counts: orderCounts })
    cy.contains('button', 'Try again').click()
    cy.contains('No orders here').should('be.visible')
  })
})

describe('Approval review', () => {
  beforeEach(() => {
    cy.viewport(390, 844)
    cy.intercept('**/api/**', { statusCode: 503, body: { message: 'Unexpected test request' } })
    stubSharedRequests()
  })

  const pending = {
    id: 12, entity_type: 'category', entity_label: 'Category', action_type: 'create', status: 'pending',
    summary: 'Category: Running', requester: { id: 2, name: 'Ada Admin', email: 'ada@example.test', initials: 'AA' },
    reviewer: null, submitted_at: '2026-09-11T00:00:00Z', reviewed_at: null, rejection_reason: null, image_count: 0,
  }

  it('reviews a pending request and confirms before publishing', () => {
    cy.intercept('GET', '**/api/approvals?*', { data: [pending], current_page: 1, last_page: 1, total: 1, counts: approvalCounts }).as('approvals')
    cy.intercept('GET', '**/api/approvals/12', {
      ...pending,
      fields: [{ key: 'category_name', label: 'Category name', value: 'Running' }],
      images: [],
      raw_payload: { category_name: 'Running' },
    }).as('approval')
    cy.intercept('POST', '**/api/approvals/review', (req) => {
      expect(req.body).to.deep.equal({ ids: [12], decision: 'approved' })
      req.reply({ message: '1 request(s) approved.', reviewed: [12], failed: [] })
    }).as('review')

    signIn('/tabs/approvals')
    cy.wait('@approvals')
    cy.contains('button.row', 'Category: Running').click()
    cy.wait('@approval')
    cy.contains('Ada Admin').should('be.visible')
    cy.contains('Approving applies the change').should('be.visible')

    cy.contains('button', 'Approve and publish').click()
    cy.get('ion-alert').contains('button', 'Cancel').click()
    cy.get('@review.all').should('have.length', 0)

    cy.contains('button', 'Approve and publish').click()
    cy.get('ion-alert').contains('button', 'Approve').click()
    cy.wait('@review')
    cy.location('pathname').should('equal', '/tabs/approvals')
  })

  it('requires a reason before rejecting', () => {
    cy.intercept('GET', '**/api/approvals?*', { data: [pending], current_page: 1, last_page: 1, total: 1, counts: approvalCounts })
    cy.intercept('GET', '**/api/approvals/12', { ...pending, fields: [], images: [], raw_payload: {} })
    cy.intercept('POST', '**/api/approvals/review', { message: '1 request(s) rejected.', reviewed: [12], failed: [] }).as('reject')
    signIn('/tabs/approvals/12')

    cy.contains('button', 'Reject with a reason').click()
    cy.get('ion-alert').contains('button', 'Reject').click()
    // Blank reasons are ignored, so nothing is submitted.
    cy.get('@reject.all').should('have.length', 0)
    cy.contains('button', 'Reject with a reason').should('be.visible')
  })
})

describe('Account management', () => {
  beforeEach(() => {
    cy.viewport(390, 844)
    cy.intercept('**/api/**', { statusCode: 503, body: { message: 'Unexpected test request' } })
    stubSharedRequests()
  })

  const customer = {
    id: 7, name: 'Cara Customer', email: 'cara@example.test', initials: 'CC', role: 'user', role_label: 'Customer',
    is_active: true, status: 'Active', email_verified: true, created_at: '2026-01-01T00:00:00Z', orders_count: 3,
  }

  it('suspends a customer after a confirmation and refreshes the account', () => {
    cy.intercept('GET', '**/api/users?*', { data: [customer], current_page: 1, last_page: 1, total: 1, counts: accountCounts }).as('users')
    cy.intercept('GET', '**/api/users/7', {
      ...customer, approvals_submitted: 0, approvals_pending: 0, invited_by: null, can_suspend: true, recent_activity: [],
    }).as('user')
    cy.intercept('PATCH', '**/api/users/7/status', (req) => {
      expect(req.body).to.deep.equal({ is_active: false })
      req.reply({ message: 'Account suspended.', user: { ...customer, is_active: false, status: 'Suspended' } })
    }).as('suspend')

    signIn('/tabs/users')
    cy.wait('@users')
    cy.contains('button.row', 'Cara Customer').click()
    cy.wait('@user')

    cy.contains('button', 'Suspend this customer').click()
    cy.get('ion-alert').contains('button', 'Suspend').click()
    cy.wait('@suspend')
    cy.contains('Account suspended').should('be.visible')
  })

  it('invites an admin through the existing workflow', () => {
    cy.intercept('POST', '**/api/admin-invitations', (req) => {
      expect(req.body).toEqual({ email: 'new.admin@example.test' })
      req.reply({ statusCode: 201, body: { message: 'Invitation sent.', invitation: { id: 1, email: 'new.admin@example.test' } } })
    }).as('invite')
    cy.intercept('GET', '**/api/admin-invitations', { data: [], current_page: 1, last_page: 1, total: 0 })

    signIn('/tabs/users/admins/invite')
    cy.get('input[type="email"]').type('new.admin@example.test')
    cy.contains('button', 'Send invitation').click()
    cy.wait('@invite')
    cy.location('pathname').should('equal', '/tabs/users/admins/invitations')
  })
})

describe('Notifications', () => {
  beforeEach(() => {
    cy.viewport(390, 844)
    cy.intercept('**/api/**', { statusCode: 503, body: { message: 'Unexpected test request' } })
    stubSharedRequests()
  })

  it('opens the alert it is attached to and marks it read', () => {
    const alert = {
      id: '9f1c6a8e-0000-4000-8000-000000000001', type: 'order_paid', title: 'Order #91 paid',
      body: 'Order #91 - PHP 2,500.00.', route: '/tabs/orders/91',
      meta: { order_id: 91 }, read: false, created_at: '2026-09-11T01:31:00Z',
    }
    cy.intercept('GET', '**/api/notifications?*', { data: [alert], current_page: 1, last_page: 1, total: 1, counts: { unread: 2 } }).as('notifications')
    cy.intercept('POST', '**/api/notifications/*/read', { message: 'Notification marked as read.', notification: { ...alert, read: true }, unread: 1 }).as('read')
    cy.intercept('GET', '**/api/orders/91', orderDetail)

    signIn('/tabs/notifications')
    cy.wait('@notifications')
    cy.contains('Order #91 paid').should('be.visible')
    cy.contains('button.row', 'Order #91 paid').click()
    cy.wait('@read')
    cy.location('pathname').should('equal', '/tabs/orders/91')
    cy.screenshot('superadmin-notification')
  })

  it('marks every notification read', () => {
    const alert = {
      id: '9f1c6a8e-0000-4000-8000-000000000002', type: 'inventory_low_stock', title: 'Low stock alert',
      body: 'Runner - Size 9 / Black now has 3 unit(s) left.', route: '/tabs/inventory',
      meta: {}, read: false, created_at: '2026-09-11T01:20:00Z',
    }
    cy.intercept('GET', '**/api/notifications?*', { data: [alert], current_page: 1, last_page: 1, total: 1, counts: { unread: 1 } })
    cy.intercept('POST', '**/api/notifications/read-all', { message: 'All notifications marked as read.', unread: 0 }).as('readAll')
    signIn('/tabs/notifications')

    cy.contains('button', 'Mark all read').click()
    cy.wait('@readAll')
    cy.contains('All notifications marked as read.').should('be.visible')
  })
})

describe('Super Admin only sign in', () => {
  beforeEach(() => {
    cy.viewport(390, 844)
    cy.intercept('**/api/**', { statusCode: 503, body: { message: 'Unexpected test request' } })
  })

  it('refuses a non Super Admin account', () => {
    cy.intercept('POST', '**/api/login', { statusCode: 403, body: { message: 'This app is reserved for Super Admin accounts.' } }).as('login')
    cy.visit('/login')
    cy.contains('Admin and Customer accounts cannot use this app').should('be.visible')
    cy.get('input[type="email"]').type('admin@example.test')
    cy.get('input[type="password"]').type('secret')
    cy.contains('button', 'Sign in').click()
    cy.wait('@login')
    cy.contains('This app is reserved for Super Admin accounts.').should('be.visible')
    cy.screenshot('superadmin-login')
  })

  it('keeps the intended destination through an expired session', () => {
    cy.intercept('GET', '**/api/orders/91', { statusCode: 401, body: { message: 'Unauthenticated.' } }).as('expired')
    signIn('/tabs/orders/91')
    cy.wait('@expired')
    cy.location('pathname').should('equal', '/login')
    cy.location('search').should('contain', 'redirect=')

    cy.intercept('POST', '**/api/login', { token: 'new-session', user: session })
    cy.intercept('GET', '**/api/orders/91', orderDetail).as('orderDetail')
    cy.get('input[type="email"]').type('root@example.test')
    cy.get('input[type="password"]').type('secret')
    cy.contains('button', 'Sign in').click()
    cy.wait('@orderDetail')
    cy.contains('Achilles Runner').should('be.visible')
  })
})