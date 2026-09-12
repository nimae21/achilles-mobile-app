import { alertController, toastController } from '@ionic/vue'

/** Confirmation dialog for sensitive actions (suspend, approve, reject...). */
export async function confirmAction(options: {
  header: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}): Promise<boolean> {
  const alert = await alertController.create({
    header: options.header,
    message: options.message,
    cssClass: options.danger ? 'alert-danger' : undefined,
    buttons: [
      { text: options.cancelText ?? 'Cancel', role: 'cancel' },
      { text: options.confirmText ?? 'Confirm', role: 'confirm' },
    ],
  })
  await alert.present()
  const { role } = await alert.onDidDismiss()
  return role === 'confirm'
}

/** Rejection reason prompt. Returns null when the user cancels or leaves it blank. */
export async function promptReason(options: {
  header: string
  message: string
  placeholder?: string
  confirmText?: string
}): Promise<string | null> {
  const alert = await alertController.create({
    header: options.header,
    message: options.message,
    cssClass: 'alert-danger',
    inputs: [
      {
        name: 'reason',
        type: 'textarea',
        placeholder: options.placeholder ?? 'Explain what needs to change.',
      },
    ],
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { text: options.confirmText ?? 'Reject', role: 'confirm' },
    ],
  })
  await alert.present()
  const { role, data } = await alert.onDidDismiss<{ values?: { reason?: string } }>()
  if (role !== 'confirm') return null
  const reason = (data?.values?.reason ?? '').trim()
  return reason.length ? reason : null
}

export async function toast(message: string, color: 'success' | 'danger' | 'medium' = 'success'): Promise<void> {
  const instance = await toastController.create({
    message,
    duration: color === 'danger' ? 4200 : 2400,
    position: 'bottom',
    color,
  })
  await instance.present()
}