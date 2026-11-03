import Swal from 'sweetalert2';
import fr from '@/messages/fr.json';
import en from '@/messages/en.json';
import rn from '@/messages/rn.json';

let confirmationHandledUntil = 0;

export function confirmationHasBeenHandled(): boolean {
  return Date.now() < confirmationHandledUntil;
}

export function marquerConfirmationGeree(): void {
  confirmationHandledUntil = Date.now() + 10_000;
}

export function consommerConfirmationGeree(): void {
  confirmationHandledUntil = 0;
}

export function getMutationConfirmationCopy(method: string, url = '') {
  const locale = typeof document !== 'undefined'
    ? (document.documentElement.lang || 'fr').slice(0, 2)
    : 'fr';
  const messages = locale === 'en' ? en : locale === 'rn' ? rn : fr;
  const copy = messages.common.confirmationMutating;
  const upperUrl = url.toLowerCase();

  if (method.toUpperCase() === 'DELETE' || upperUrl.includes('delete') || upperUrl.includes('supprimer') || upperUrl.includes('deactivate') || upperUrl.includes('desactiver')) {
    return { title: copy.deleteTitle, message: copy.deleteMessage, destructive: true };
  }
  if (method.toUpperCase() !== 'DELETE') {
    return { title: copy.saveTitle, message: copy.saveMessage, destructive: false };
  }
  return { title: copy.defaultTitle, message: copy.defaultMessage, destructive: true };
}

interface SweetAlertConfirmationOptions {
  title: string;
  confirmButtonText: string;
  cancelButtonText: string;
  destructive?: boolean;
}

export async function confirmerAvecSweetAlert(
  message: string,
  options: SweetAlertConfirmationOptions,
): Promise<boolean> {
  const result = await Swal.fire({
    title: options.title,
    text: message,
    icon: options.destructive ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: options.confirmButtonText,
    cancelButtonText: options.cancelButtonText,
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
    customClass: {
      popup: 'ams-sweetalert-popup',
      title: 'ams-sweetalert-title',
      htmlContainer: 'ams-sweetalert-message',
      actions: 'ams-sweetalert-actions',
      confirmButton: options.destructive
        ? 'ams-sweetalert-confirm ams-sweetalert-confirm-destructive'
        : 'ams-sweetalert-confirm',
      cancelButton: 'ams-sweetalert-cancel',
    },
  });

  if (result.isConfirmed) {
    marquerConfirmationGeree();
  }
  return result.isConfirmed;
}
