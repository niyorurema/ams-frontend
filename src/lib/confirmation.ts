import Swal from 'sweetalert2';

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

  return result.isConfirmed;
}
