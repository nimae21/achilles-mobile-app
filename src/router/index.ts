import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { Preferences } from '@capacitor/preferences'
import TabsPage from '../views/TabsPage.vue'
import { safeNotificationRedirect } from '../services/notification-routing'

const routes: Array<RouteRecordRaw> = [
  { path: '/', redirect: '/tabs/dashboard' },
  { path: '/login', component: () => import('../views/LoginPage.vue') },
  {
    path: '/tabs/',
    component: TabsPage,
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/tabs/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/DashboardPage.vue') },
      { path: 'orders', name: 'orders', component: () => import('../views/OrdersPage.vue') },
      { path: 'orders/:id', name: 'order', component: () => import('../views/OrderDetailPage.vue') },
      { path: 'approvals', name: 'approvals', component: () => import('../views/ApprovalsPage.vue') },
      { path: 'approvals/:id', name: 'approval', component: () => import('../views/ApprovalDetailPage.vue') },
      { path: 'users', name: 'users', component: () => import('../views/UsersPage.vue') },
      { path: 'users/admins', name: 'admins', component: () => import('../views/AdminsPage.vue') },
      {
        path: 'users/admins/invitations',
        name: 'invitations',
        component: () => import('../views/InvitationsPage.vue'),
      },
      {
        path: 'users/admins/invite',
        name: 'invite-admin',
        component: () => import('../views/InviteAdminPage.vue'),
      },
      { path: 'users/admins/:id', name: 'admin', component: () => import('../views/AdminDetailPage.vue') },
      { path: 'users/:id', name: 'user', component: () => import('../views/UserDetailPage.vue') },
      { path: 'notifications', name: 'notifications', component: () => import('../views/NotificationsPage.vue') },
      { path: 'logs', name: 'logs', component: () => import('../views/LogsPage.vue') },
      { path: 'logs/:id', name: 'log', component: () => import('../views/LogDetailPage.vue') },
      { path: 'inventory', name: 'inventory', component: () => import('../views/InventoryPage.vue') },
      { path: 'profile', name: 'profile', component: () => import('../views/ProfilePage.vue') },
      { path: 'settings', name: 'settings', component: () => import('../views/SettingsPage.vue') },
      { path: 'more', name: 'more', component: () => import('../views/MorePage.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/tabs/dashboard' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Auth guard: the token is the only thing that matters here. Every endpoint is
// still authorised server-side, so this is purely a navigation convenience.
router.beforeEach(async (to) => {
  const { value: token } = await Preferences.get({ key: 'auth_token' })
  const isAuthenticated = !!token

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (to.path === '/login' && isAuthenticated) {
    return safeNotificationRedirect(to.query.redirect)
  }
})

export default router