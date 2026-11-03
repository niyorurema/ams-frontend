'use client';

import { useEffect } from 'react';
import { confirmerAvecSweetAlert } from '@/lib/confirmation';

const CANCEL_WORDS = new Set([
  'annuler', 'cancel', 'cancel changes', 'cancel edit', 'close', 'fermer', 'retour', 'reka', 'funga',
]);

export function MutationConfirmationGuard() {
  useEffect(() => {
    const handleClickCapture = async (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button') : null;
      if (!target || target.closest('.swal2-container')) return;
      if (target instanceof HTMLButtonElement && target.dataset.confirmationBypass === 'true') return;

      const text = target.textContent?.trim().toLocaleLowerCase() ?? '';
      const ariaLabel = target.getAttribute('aria-label')?.toLocaleLowerCase() ?? '';
      const isCancel = [...CANCEL_WORDS].some((word) => text === word || text.startsWith(`${word} `));
      if (!isCancel && !ariaLabel.includes('cancel') && !ariaLabel.includes('annuler')) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const locale = document.documentElement.lang.slice(0, 2);
      const copy = locale === 'en'
        ? { title: 'Confirm cancellation', message: 'Unsaved changes will be lost. Do you want to continue?', confirm: 'Confirm', cancel: 'Cancel' }
        : locale === 'rn'
          ? { title: 'Emeza guhagarika', message: 'Impinduka zitabitswe zizoba zaburitswe. Urashaka gukomeza?', confirm: 'Emeza', cancel: 'Reka' }
          : { title: 'Confirmer l’annulation', message: 'Les modifications non enregistrées seront perdues. Voulez-vous continuer ?', confirm: 'Confirmer', cancel: 'Annuler' };

      const confirmed = await confirmerAvecSweetAlert(copy.message, {
        title: copy.title,
        confirmButtonText: copy.confirm,
        cancelButtonText: copy.cancel,
      });
      if (!confirmed) return;

      target.setAttribute('data-confirmation-bypass', 'true');
      target.click();
      target.removeAttribute('data-confirmation-bypass');
    };

    document.addEventListener('click', handleClickCapture, true);
    return () => document.removeEventListener('click', handleClickCapture, true);
  }, []);

  return null;
}
